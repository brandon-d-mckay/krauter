const {expect} = require('chai');
const sinon = require('sinon');
const {request: Request, response: Response} = require('express');

describe('krauter', () => {
	it('should replace `null` with middleware that deletes `req.data`', () => {
		const before = {};
		let after;
		
		const sut = require('.')(undefined);
		const request = Object.assign(Object.create(Request), {method: 'get', url: '/test'});
		const response = Object.create(Response);
		
		sut.get('/test',
			(req, res, next) => { req.data = before; next(); },
			null,
			(req, res, next) => { after = req.data; }
		);
		
		sut(request, response, undefined);
		
		expect(after).to.be.undefined;
	});
	
	it('should replace a unary function with middleware that deletes and sets `req.data`', () => {
		const before = {};
		let input;
		const output = {};
		let after;
		
		const sut = require('.')(undefined);
		const request = Object.assign(Object.create(Request), {method: 'get', url: '/test'});
		const response = Object.create(Response);
		
		sut.get('/test',
			(req, res, next) => { req.data = before; next(); },
			({req, res, data}) => { input = req.data; return output; },
			(req, res, next) => { after = req.data; }
		);
		
		sut(request, response, undefined);
		
		expect(input).to.be.undefined;
		expect(after).to.equal(output);
	});
	
	it('should replace a string with middleware that queries it to the executor and sets `req.data` with the returned value', async () => {
		const before = undefined;
		const query = 'test';
		const returned = {};
		let _resolve, after = new Promise((resolve, reject) => { _resolve = resolve; });
		
		const executor = sinon.spy(query => Promise.resolve(returned));
		const sut = require('.')(executor);
		const request = Object.assign(Object.create(Request), {method: 'get', url: '/test'});
		const response = Object.create(Response);
		
		sut.get('/test',
			(req, res, next) => { req.data = before; next(); },
			query,
			(req, res, next) => { _resolve(req.data); }
		);
		
		sut(request, response, undefined);
		
		after = await after;
		
		sinon.assert.calledOnce(executor);
		sinon.assert.calledWith(executor, query);
		expect(after).to.equal(returned);
	});
	
	it('should replace an object with middleware that queries each property to the executor and sets the returned value to `req.data` with the same key', async () => {
		const before = undefined;
		const queries = {test1: 'test1', test2: 'test2', test3: 'test3'};
		const returned = {test1: {}, test2: {}, test3: {}};
		let _resolve, after = new Promise((resolve, reject) => { _resolve = resolve; });
		
		const executor = sinon.spy(query => Promise.resolve(returned[query]));
		const sut = require('.')(executor);
		const request = Object.assign(Object.create(Request), {method: 'get', url: '/test'});
		const response = Object.create(Response);
		
		sut.get('/test',
			(req, res, next) => { req.data = before; next(); },
			queries,
			(req, res, next) => { _resolve(req.data); }
		);
		
		sut(request, response, err => { throw err; });
		
		after = await after;
		
		sinon.assert.calledThrice(executor);
		sinon.assert.calledWith(executor, queries.test1);
		sinon.assert.calledWith(executor, queries.test2);
		sinon.assert.calledWith(executor, queries.test3);
		expect(after.test1).to.equal(returned.test1);
		expect(after.test2).to.equal(returned.test2);
		expect(after.test3).to.equal(returned.test3);
	});
	
	it('should replace a number with middleware that sets the status of `res` to that number', () => {
		const sut = require('.')(undefined);
		const request = Object.assign(Object.create(Request), {method: 'get', url: '/test'});
		const response = Object.create(Response);
		
		const before = 200;
		const number = 600;
		let after;
		
		sut.get('/test',
			(req, res, next) => { res.status(before); next(); },
			number,
			(req, res, next) => { after = res.statusCode; }
		);
		
		sut(request, response, undefined);
		
		expect(after).to.equal(number);
	});
});
