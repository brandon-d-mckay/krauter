const express = require("express");

const methods = ["all", "checkout", "copy", "delete", "get", "head", "lock", "merge",
	"mkactivity", "mkcol", "move", "m-search", "notify", "options", "patch", "post",
	"purge", "put", "report", "search", "subscribe", "trace", "unlock", "unsubscribe"];

const privates = Symbol();

class Kraut {
	constructor(krauter, path) {
		this[privates] = {
			krauter: krauter,
			path: path
		};
	}
}

methods.forEach(method =>
	Kraut.prototype[method] = function(... args) {
		this[privates].krauter[method](this[privates].path, ... args);
		return this;
});

class Krauter {
	constructor(execute, options = {}) {
		const krauter = (req, res, next) => krauter[privates].router.handle(req, res, err => {
			if(!err && req.data) res.status(200).send(req.data);
			else next(err);
		});
		
		krauter[privates] = {
			router: express.Router(options),
			execute: execute,
		};
		
		Object.setPrototypeOf(krauter, Krauter.prototype);
		
		return krauter;
	}
	
	route(path) {
		return new Kraut(this, path);
	}
}

methods.forEach(method => Krauter.prototype[method] = function(... args) {
	const path = args.shift();
	if(typeof path !== "string") throw Error("You must specify a route path.");
	
	return this[privates].router[method](path, args.map(arg => {
		if(typeof arg === "string") {
			return (req, res, next) => {
				this[privates].execute(... replace(arg, req)).then(results => {
					req.data = results;
					next();
				}).catch(next);
			};
		}
		
		else if(typeof arg === "object") {
			return (req, res, next) => {
				req.data = {};
				
				Promise.all(Object.keys(arg).map(key =>
					this[privates].execute(... replace(arg[key], req)).then(results => {
						req.data[key] = results;
					}))
				).then(() => next()).catch(next);
			};
		}
		
		else if(typeof arg === "function" && arg.length === 1) {
			return (req, res, next) => {
				req.data = arg(req.data);
				next();
			}
		}
		
		return arg;
	}));
});

["use", "param"].forEach(method =>
	Krauter.prototype[method] = function(... args) {
		this[privates].router[method](... args);
});

function replace(query, req, values = [], types = []) {
	return [
		query.replace(/(?:^|[^:]):(?:\((\w+)\))?([\w]+(?:\.[\w]+)*):/g, (match, type, reference) =>
			"?v" + (0&types.push(type) || values.push(reference.split(".").reduce((o, p) => o[p], req)) - 1) + "?"
		),
		values,
		types
	];
}

module.exports = (... args) => new Krauter(... args);

Object.assign(module.exports, {
	pg: {
		executor: conn => (query, values) =>
			conn.query(query.replace(/\?(?:\(\w+\))?v(\d+)\?/g, '$$$1'), values)
	},
	
	mysql: {
		executor: conn => (query, values) =>
			new Promise((resolve, reject) => {
				conn.query(query.replace(/\?(\(\w+\))?v\d+\?/g, '?'), values, (err, results, fields) =>
					err ? reject(err) : resolve({results: results, fields: fields})
				);
			})
	},
	
	mssql: {
		executor: (conn, mssql) => {
			global[privates].mssql = global[privates].mssql || mssql || require("mssql");
			
			return (query, values, types) => {
				const request = conn.request();
				for(let i = 0; i < values.length; i++) request.input("v" + i, ... (types[i] ? [global[privates].mssql[types[i]], values[i]] : [values[i]]));
				return request.query(query.replace(/\?(\(\w+\))?(v\d+)\?/g, '@$1'));
			};
		}
	},
	
	sqlite3: {
		executor: conn => (query, values) =>
			new Promise((resolve, reject) => {
				conn.query(query.replace(/\?(\(\w+\))?v\d+\?/g, '?'), values, (err, rows) =>
					err ? reject(err) : resolve(rows)
				);
			})
	}
});
