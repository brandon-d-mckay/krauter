# krauter
*krauter* allows you to quickly create data-backed web services by configuring an *Express* router with a database connection and automatically producing parameterized query middleware from strings and objects. Middleware can also be produced from unary functions (sets the value of `req.data`) and numbers (sets the HTTP response status code). 

It currently supports hassle-free integration with PostgreSQL ([*pg*](https://github.com/brianc/node-postgres)), MySQL ([*mysql*](https://github.com/mysqljs/mysql)), SQL Server ([*mssql*](https://github.com/tediousjs/node-mssql)), and SQLite ([*sqlite3*](https://github.com/mapbox/node-sqlite3)).

## Installation

```shell
npm install --save krauter
```

And depending on which DBMS is being used: 

```shell
npm install --save pg
npm install --save mysql
npm install --save mssql
npm install --save sqlite3
```

## Configuration

Each `Krauter` must be created with a supplied executor function that simply takes a query along with an array of parameter values (and optionally an array of corresponding datatypes) and returns a promise for the results (or an error). *krauter* has predefined executors available for supported DBMSs. These can be accessed by calling `krauter.DBMS.executor` (where `DBMS` is the name of a supported DBMS's *npm* package) with a corresponding connection/pool, which will return an executor function configured to run queries on that specific connection/pool.

```javascript
const krauter = require("krauter");
const mysql = require("mysql");

// Create database connection pool
const pool = mysql.createPool({
	host: process.env.DB_HOSTNAME,
	username: process.env.DB_USERNAME,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME
});

// Create a Krauter
const api = krauter(krauter.mysql.executor(pool));
```

## Usage

A `Krauter` works the same as a normal *Express* router, but with the added capability of its HTTP methods (including `all`) taking various argument types and internally replacing them with middleware. 

### Database Queries

When a string is encountered (aside from the route path, which **must** be specified to avoid ambiguity), it is replaced with a middleware function that will execute the string as a query to the configured database and then store the result to `req.data`. 

```javascript
api.get("/products", "SELECT * FROM products");
```

When an object is encountered, each of its properties' values will be treated as a query (to be ran in parallel) with each result being stored as a property of `req.data` (with the same key). 

```javascript
api.get("/filters", {categories: "SELECT * FROM categories", merchants: "SELECT * FROM merchants"});
```

##### Parameters

JavaScript values can be specified within query strings and they will automatically be inserted to form a parameterized query (preventing SQL injection). Values may be any recursive property of the `req` object and are denoted in dot notation within surrounding colons.

```javascript
api.get("/merchants/:id", "SELECT * FROM merchants WHERE id = :params.id:");
```

For DBMSs that typically have datatypes specified for parameters (such as *mssql*), the datatype can be denoted within surrounding braces preceding the specified property. 

```javascript
api.patch("/products", authenticate, "INSERT INTO products VALUES(:{VarChar(45)}body.name:, :{Int}body.merchantId:)"); 
```

### Transformations of `req.data`

When a unary function is encountered, it is replaced with a middleware function that will call it with the supplied argument being an object containing properties `req`, `res`, and `data`, where `data` takes (and deletes) the value of 
`req.data`. The return value of the unary function is then subsequently set to `req.data`. 

The parameters usually found in a middleware function can be defined within a unary function in a syntactically similar manner by using destructuring assignments and unpacking them from the object argument.

```javascript
api.get("/orders/:id", 
	authenticate, 
	"SELECT * FROM orders WHERE id = :params.id:", 
	({req, res, data: [{confirmed, ... rest}]}) => 
		({confirmed: new Date(confirmed).toLocaleString(req.user.language, {timeZone: req.user.timeZone}), ... rest}));
```

### HTTP Response Status Codes

When a number is encountered, it is replaced with a middleware function that will set it as the response's status code.

```javascript
api.delete("/products/:id", authenticate, "DELETE FROM products WHERE id = :params.id:", 204);
```

### Automatic Responses

Each `Krauter` will automatically send a response with `req.data` as the body if it is defined and the request has gone unanswered.

## Contributing
Check out the [issues](https://github.com/brandon-d-mckay/krauter/issues) page or make a [pull request](https://github.com/brandon-d-mckay/krauter/pulls) to contribute!
