# krauter
*krauter* allows you to quickly create data-backed web services by configuring an *Express* router with a database connection and automatically producing parameterized query middleware from strings and objects. Similar functionality is offered for unary functions (used to transform `req.data`) and numbers (used to set the HTTP response status code). 

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

Each `Krauter` must be created with a supplied *executor* function that simply takes a query along with an array of parameter values (and optionally an array of corresponding datatypes) and returns a Promise for its results (or an error if one occurs). *krauter* has predefined executors available for supported DBMSs. These can be accessed by calling `krauter.DBMS.executor` (where `DBMS` is the DBMS package name) with a corresponding connection/pool and will return an executor configured to run queries on the specified connection/pool.

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

A `Krauter` works the same as a normal *Express* router, but with the added capability of its HTTP methods taking various argument types and replacing them with middleware. 

### Queries

When a string is encountered (aside from the route path, which **must** be specified to avoid ambiguity), it is replaced internally with a middleware function that will execute the string as a query to the configured database and then store the result to `req.data`. 

```javascript
api.get("/products", "SELECT * FROM products");
```

When an object is encountered, each of its properties' values will be treated as a query (to be ran in parallel) with each result being stored as a property of `req.data` (with the same key). 

```javascript
api.get("/search", {categories: "SELECT * FROM categories", merchants: "SELECT * FROM merchants"});
```

#### Parameters

JavaScript values can be specified within query strings and they will automatically be inserted to form a parameterized query (preventing SQL injection). Values may be any recursive property of the `req` object and are denoted in dot notation within surrounding colons.

```javascript
api.get("/merchants/:id", "SELECT * FROM merchants WHERE id = :params.id:");
```

For DBMSs that typically have datatypes specified for parameters (such as *mssql*), the datatype can be denoted within surrounding braces preceding the property name. 

```javascript
api.patch("/products", authorize, "INSERT INTO products VALUES(:{VarChar(45)}body.name:, :{Int}body.merchant:)"); 
```

### Transformations of `req.data`

When a unary function is encountered, it is replaced with a middleware function that will call it with `req.data` as the argument and then subsequently set `req.data` to the returned value.

```javascript
api.get("/products/:id", "SELECT * FROM products WHERE id = :params.id:", ({modified, ... rest}) => ({modified: new Date(modified * 1000).toTimeString(), ... rest}));
```

### HTTP Response Status Codes

When a number is encountered, it is replaced with a middleware function that will set it as the response's status code.

```javascript
api.delete("/products/:id", authorize, "DELETE FROM products WHERE id = :params.id:", 204);
```

### Automatic Responses

Additionally, a `Krauter` will automatically send a response with `req.data` as the body if it is defined and the request has gone unanswered.

## Contributing
Check out the [issues](https://github.com/brandon-d-mckay/krauter/issues) page or make a [pull request](https://github.com/brandon-d-mckay/krauter/pulls) to contribute!
