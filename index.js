const express = require('express');
const methods = require('methods').concat('all');
const privates = Symbol();

class Kraut {
	constructor(krauter, path) {
		this[privates] = {
			krauter,
			path
		};
	}
}

methods.forEach(method =>
	Kraut.prototype[method] = function (... args) {
		this[privates].krauter[method](this[privates].path, ... args);
		return this;
	}
);

class Krauter {
	constructor(execute, options) {
		const krauter = (req, res, next) => krauter[privates].router(req, res, err => {
			if(!res.finished && req.matched && err === undefined) res.send(req.data); // `err === null` if `next('router')` was called
			else next(err);
		});
		
		krauter[privates] = {
			router: express.Router(options),
			execute
		};
		
		Object.setPrototypeOf(krauter, Krauter.prototype);
		
		return krauter;
	}
	
	route(path) {
		return new Kraut(this, path);
	}
}

methods.forEach(method => Krauter.prototype[method] = function (path, ... args) {
	this[privates].router[method](path, (req, res, next) => { req.matched = true; next(); }, args.map(arg => {
		if(arg === null) {
			return (req, res, next) => {
				delete req.data;
				next();
			};
		}
		
		else if(typeof arg === 'function' && arg.length <= 1) {
			return (req, res, next) => {
				const data = req.data;
				req.next = req.data = undefined;
				
				try {
					req.data = arg({req, res, data});
				}
				finally {
					req.next = next;
				}
				
				next();
			};
		}

		else if(typeof arg === 'string') {
			return (req, res, next) => {
				this[privates].execute(... parse(arg, req)).then(result => {
					req.data = result;
					next();
				}).catch(next);
			};
		}
		
		else if(typeof arg === 'object') {
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
		
		else if(typeof arg === 'number') {
			return (req, res, next) => {
				res.status(arg);
				next();
			};
		}

		else return arg;
	}));
	
	return this;
});

['use', 'param'].forEach(method =>
	Krauter.prototype[method] = function (... args) {
		this[privates].router[method](... args);
	}
);

function parse(string, req, values = [], types = []) {
	return [
		string.replace(/(^|[^:]):(?:{(\w+)(?:\(([\d, ]*)\))?})?([\w]+(?:\.[\w]+)*):/g, (match, precedingChar, typeProperty, typeArguments, reference) =>
			precedingChar + '?param' + (0&types.push({property: typeProperty, arguments: typeArguments}) || values.push(reference.split('.').reduce((o, p) => o[p], req))) + '?'
		),
		values,
		types
	];
}

const krauter = (... args) => new Krauter(... args);

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
		executor: conn => {
			const mssql = require('mssql');
			
			function getMssqlType(type) {
				const property = mssql[type.property];
				return type.arguments ? property(... type.arguments.split(',').map(arg => +arg.trim())) : property;
			}
			
			return (query, values, types) => {
				const request = conn.request();
				for(let i = 0; i < values.length; i++) request.input(`param${i + 1}`, ... (types[i].property ? [getMssqlType(types[i]), values[i]] : [values[i]]));
				return request.query(query.replace(/\?(param\d+)\?/g, '@$1'));
			};
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
