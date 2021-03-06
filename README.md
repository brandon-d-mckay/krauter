# krauter <sup>[![version][version-badge]][npm-url]</sup>

[![build status][build-badge]][build-url]
[![dependency status][dependencies-badge]][dependencies-url]
[![license][license-badge]][license-url]
[![downloads][downloads-badge]][downloads-url]

[![npm][npm-badge]][npm-url]

*krauter* allows you to quickly create data-backed web services by configuring an [*Express*](https://github.com/expressjs/express) router with a database connection and automatically producing parameterized query middleware from strings and objects. Middleware can also be produced from integers (sets the HTTP response status code), unary functions (sets the value of `req.data`), and `null` (clears the value of `req.data`).

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

Each `Krauter` must be created with a supplied executor function that simply takes a query along with an array of parameter values (and optionally an array of corresponding datatypes) and returns a promise for the results. *krauter* has predefined executors available for supported DBMSs. These can be used by calling `krauter.DBMS(connection[, options])` (where `DBMS` is the name of a supported DBMS's *npm* package) with a corresponding connection/pool and an options object (used for the *Express* router), which will return a `Krauter` configured to run queries on that specific connection/pool.

```javascript
const krauter = require('krauter');
const mysql = require('mysql');

// Create database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Create a Krauter
const api = krauter.mysql(pool);
```

A `Krauter` can also be initialized with a custom executor function:

```javascript
const api = krauter((query, values) => new Promise((resolve, reject) => { /* ... */ }));
```

## Usage

A `Krauter` works the same as a normal *Express* router, but with the added capability of its HTTP methods (including `all`) taking various argument types and internally replacing them with middleware.

### Queries

When a string is encountered, it is replaced with a middleware function that will execute the string as a query to the configured database and then store the result to `req.data`.

```javascript
api.get('/products', 'SELECT * FROM products');
```

When an object is encountered, each of its properties' values will be interpreted as a query (to be ran in parallel) with each result being stored as a property of `req.data` (with the same key).

```javascript
api.get('/filters', {categories: 'SELECT id, name FROM categories', merchants: 'SELECT id, name FROM merchants'});
```

##### Parameters

JavaScript values can be specified within query strings and they will automatically be inserted to form a parameterized query (preventing SQL injection). Values may be any recursive property of the `req` object and are denoted in dot notation within surrounding colons. 

> Note: The `res` object can be accessed with `req.res`

```javascript
api.get('/merchants/:id', 'SELECT * FROM merchants WHERE id = :params.id:');
```

For DBMSs that typically have datatypes specified for parameters (such as *mssql*), the datatype can be denoted within surrounding braces preceding the specified property.

```javascript
api.post('/products', 
    authenticate, 
    'INSERT INTO products (merchantId, name, price)' +
    'VALUES (:{Int}user.id:, :{VarChar(45)}body.name:, :{Money}body.price:)');
```

### Transformations of `req.data`

When a unary function is encountered, it is replaced with a middleware function that will call it with the supplied argument being a single object containing properties `req`, `res`, and `data`, where the value of `data` is taken (and removed) from `req.data`. The value returned from the unary function is then subsequently set to `req.data` (unless a `Query` object is returned... [see below](#returning-another-query)). 

A unary function can be defined in a syntactically similar manner as a typical middleware function by using destructuring assignments and unpacking them from the single object argument. 

```javascript
api.get('/orders/:id',
    authenticate,
    'SELECT * FROM orders WHERE id = :params.id:',
    ({req, res, data: [{confirmedUtc, ... order}]}) =>
        ({confirmedLocal: new Date(confirmedUtc).toLocaleString(req.user.language, {timeZone: req.user.timeZone}), ... order}));
```

##### Returning another `Query`

*krauter* exposes a `Query` global constructor that can be used to return a value from within a unary function which will be processed just like a normal `Krauter` HTTP method argument. You can think of it as like returning a `Promise` from within a `Promise.prototype.then()` handler... a unary function that returns a `Query` will instead return the result from executing the `Query`. This allows for the building of more dynamic queries which would otherwise be very difficult to create using only variable expansion.

##### Clearing `req.data`

When `null` is encountered, it is replaced with a middleware function that removes the value of `req.data`.

### HTTP Response Status Codes

When a number is encountered, it is replaced with a middleware function that will set it as the response's status code.

```javascript
api.put('/products/:productId/reviews/:userId', 
    authenticate, 
    'INSERT INTO reviews (productId, userId, rating, message)' +
    'VALUES (:params.productId:, :params.userId:, :body.rating:, :body.message:)',
    201);
```

### Automatic Responses

Each `Krauter` automatically sends a response with `req.data` as the body if the request previously matched a route but has not been answered. This can be bypassed singularly by calling `next('router')` within a middleware function, or completely by setting the `automatic` option to `false` when constructing your `Krauter`.

```javascript
const api = krauter(executor, {automatic: false});
```

## Testing

Clone the repo locally, and then:

```shell
npm install
npm test
```

## Contributing

Check out the [issues](https://github.com/brandon-d-mckay/krauter/issues) page or make a [pull request](https://github.com/brandon-d-mckay/krauter/pulls) to contribute!

[version-badge]: http://versionbadg.es/brandon-d-mckay/krauter.svg
[npm-badge]: https://nodei.co/npm/krauter.png
[npm-url]: https://npmjs.org/package/krauter
[build-badge]: https://img.shields.io/travis/brandon-d-mckay/krauter.svg
[build-url]: https://travis-ci.org/brandon-d-mckay/krauter
[dependencies-badge]: https://img.shields.io/david/brandon-d-mckay/krauter.svg
[dependencies-url]: https://david-dm.org/brandon-d-mckay/krauter
[license-badge]: http://img.shields.io/npm/l/krauter.svg?color=informational
[license-url]: LICENSE
[downloads-badge]: https://img.shields.io/npm/dt/krauter.svg
[downloads-url]: https://github.com/brandon-d-mckay/krauter/archive/master.zip
