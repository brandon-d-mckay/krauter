const express = require('express');
const methods = require('methods').concat('all');
const privates = Symbol();

// Replaces Express `Route` class
class Kraut {
	constructor(krauter, path) {
		this[privates] = {
			krauter,
			path
		};
	}
}

// Add `Route` delegate methods
methods.forEach(method =>
	Kraut.prototype[method] = function (... args) {
		this[privates].krauter[method](this[privates].path, ... args);
		return this;
	}
);

// Replaces Express `Router` class
class Krauter {
	constructor(execute, {automatic = true, ... options} = {}) {
		// Pass requests along to the internal `Router`
		const krauter = (req, res, next) => krauter[privates].router(req, res, err => {
			if (automatic && req.matched && !res.finished && err === undefined) res.send(req.data); // `err === null` if `next('router')` was called
			else next(err);
		});
		
		krauter[privates] = {
			router: express.Router(options),
			execute
		};
		
		return Object.setPrototypeOf(krauter, Krauter.prototype);
	}
	
	route(path) {
		return new Kraut(this, path);
	}
}

// Add `Router` delegate methods
methods.forEach(method =>
	Krauter.prototype[method] = function (path, ... args) {
		this[privates].router[method](path, (req, res, next) => { req.matched = true; next(); }, ... args.map(transform.bind(this)));
		return this;
	}
);

['use', 'param'].forEach(method =>
	Krauter.prototype[method] = function (... args) {
		this[privates].router[method](... args);
		return this;
	}
);

function transform(arg) {
	// `null` => clears `req.data`
	if (arg === null) {
		return (req, res, next) => {
			req.data = undefined;
			next();
		};
	}
	
	// unary function => sets `req.data`
	else if (typeof arg === 'function' && arg.length <= 1) {
		return (req, res, next) => {
			const {data} = req;
			req.next = req.data = undefined;
			
			try {
				req.data = arg({req, res, data});
			}
			finally {
				req.next = next;
			}
			
			if (req.data instanceof Query)
				transform.bind(this)(req.data[privates].value)(Object.assign(req, {data}), res, next);
			else
				next();
		};
	}
	
	// string => queries the executor and sets `req.data` with the return value
	else if (typeof arg === 'string') {
		return (req, res, next) => {
			this[privates].execute(... parse(arg, req)).then(result => {
				req.data = result;
				next();
			}).catch(next);
		};
	}
	
	// object => queries each property to the executor and inserts the return value into `req.data` with the same key
	else if (typeof arg === 'object') {
		return (req, res, next) => {
			const results = {};
			
			Promise.all(Object.keys(arg).map(key =>
				this[privates].execute(... parse(arg[key], req)).then(result => {
					results[key] = result;
				}))
			).then(() => {
				req.data = results;
				next();
			}).catch(next);
		};
	}
	
	// number => sets the HTTP response status code
	else if (typeof arg === 'number') {
		return (req, res, next) => {
			res.status(arg);
			next();
		};
	}
	
	else return arg;
}

// Parses references from the input string and returns their resolved values along with a parameterized string
function parse(input, req, values = [], metadata = []) {
	return [
		input.replace(/(?<!:):(?:{(\w+)(?:\(([\d, ]*)\))?})?([\w]+(?:\.[\w]+)*):/g, (match, type, options, reference) =>
			`?param${(values.push(reference.split('.').reduce((o, p) => o[p], req)), metadata.push({type, options}))}?`
		),
		values,
		metadata
	];
}

class Query {
	constructor(value) {
		this[privates] = {
			value
		};
	}
}

Object.assign(global, {Query});

const krauter = (... args) => new Krauter(... args);

// npm package integrations
Object.assign(krauter, {
	pg: Object.assign((conn, options) => krauter(krauter.pg.executor(conn), options), {
		executor: conn => (query, values) => conn.query(query.replace(/\?param(\d+)\?/g, '$$$1'), values)
	}),
	
	mysql: Object.assign((conn, options) => krauter(krauter.mysql.executor(conn), options), {
		executor: conn => (query, values) => new Promise((resolve, reject) =>
			conn.query(query.replace(/\?param\d+\?/g, '?'), values, (err, results, fields) =>
				err ? reject(err) : resolve(Object.assign(results, {fields}))
			)
		)
	}),
	
	mssql: Object.assign((conn, options) => krauter(krauter.mssql.executor(conn), options), {
		executor: (conn, mssql = require('mssql')) => {
			return (query, values, metadata) => {
				const request = conn.request();
				for (let i = 0; i < values.length; i++) request.input(`param${i + 1}`, ... getMssqlType(metadata[i]), values[i]);
				return request.query(query.replace(/\?(param\d+)\?/g, '@$1'));
			};
			
			function getMssqlType(metadata, type = mssql[metadata.type]) {
				return type ? [metadata.options ? type(... metadata.options.split(',').map(arg => +arg.trim())) : type] : [];
			}
		}
	}),
	
	sqlite3: Object.assign((conn, options) => krauter(krauter.sqlite3.executor(conn), options), {
		executor: conn => (query, values) => new Promise((resolve, reject) =>
			conn.query(query.replace(/\?param\d+\?/g, '?'), values, (err, rows) =>
				err ? reject(err) : resolve(rows)
			)
		)
	})
});

module.exports = krauter;
