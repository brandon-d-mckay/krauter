const {expect} = require('chai');
const sinon = require('sinon');
const {request: Request, response: Response} = require('express');
const krauter = require('.');

describe('`Krauter`', () => {
	describe('when an HTTP method is called and transforms each argument', () => {
		it('should replace `null` with middleware that clears `req.data`', () => {
			const before = {};
			let after;
			
			const sut = krauter(undefined);
			const request = Object.assign(Object.create(Request), {method: 'get', url: '/test'});
			const response = Object.create(Response);
			
			sut.get('/test',
				(req, res, next) => { req.data = before; next(); },
				null,
				(req, _res, _next) => { after = req.data; }
			);
			
			sut(request, response, undefined);
			
			expect(after).to.be.undefined;
		});
	
		it('should replace a unary function with middleware that sets `req.data`', () => {
			const before = {};
			let input;
			const output = {};
			let after;
			
			const sut = krauter(undefined);
			const request = Object.assign(Object.create(Request), {method: 'get', url: '/test'});
			const response = Object.create(Response);
			
			sut.get('/test',
				(req, res, next) => { req.data = before; next(); },
				({req, _res, _data}) => { input = req.data; return output; },
				(req, _res, _next) => { after = req.data; }
			);
			
			sut(request, response, undefined);
			
			expect(input).to.be.undefined;
			expect(after).to.equal(output);
		});
		
		context('when a given unary function is executed and returns a `Query`', () => {
			it('should process the inner value of the `Query` as a normal `Krauter` HTTP method argument', async () => {
				const before = {};
				const query = 'test';
				let input;
				const returned = {};
				let resolve, after = new Promise(($resolve, _reject) => { resolve = $resolve; });
				
				const executor = sinon.spy(_query => Promise.resolve(returned));
				const sut = krauter(executor);
				const request = Object.assign(Object.create(Request), {method: 'get', url: '/test'});
				const response = Object.create(Response);
				
				sut.get('/test',
					(req, res, next) => { req.data = before; next(); },
					({req, _res, _data}) => { input = req.data; return new Query(query); },
					(req, _res, _next) => { resolve(req.data); }
				);
				
				sut(request, response, undefined);
				
				after = await after;
				
				sinon.assert.calledOnce(executor);
				sinon.assert.calledWith(executor, query);
				expect(input).to.be.undefined;
				expect(after).to.equal(returned);
			});
		});
		
		it('should replace a string with middleware that queries the executor and sets `req.data` with the return value', async () => {
			const before = undefined;
			const query = 'test';
			const returned = {};
			let resolve, after = new Promise(($resolve, _reject) => { resolve = $resolve; });
			
			const executor = sinon.spy(_query => Promise.resolve(returned));
			const sut = krauter(executor);
			const request = Object.assign(Object.create(Request), {method: 'get', url: '/test'});
			const response = Object.create(Response);
			
			sut.get('/test',
				(req, res, next) => { req.data = before; next(); },
				query,
				(req, _res, _next) => { resolve(req.data); }
			);
			
			sut(request, response, undefined);
			
			after = await after;
			
			sinon.assert.calledOnce(executor);
			sinon.assert.calledWith(executor, query);
			expect(after).to.equal(returned);
		});
		
		it('should replace an object with middleware that queries each property to the executor and inserts the return value into `req.data` with the same key', async () => {
			const before = undefined;
			const queries = {test1: 'test1', test2: 'test2', test3: 'test3'};
			const returned = {test1: {}, test2: {}, test3: {}};
			let resolve, after = new Promise(($resolve, _reject) => { resolve = $resolve; });
			
			const executor = sinon.spy(query => Promise.resolve(returned[query]));
			const sut = krauter(executor);
			const request = Object.assign(Object.create(Request), {method: 'get', url: '/test'});
			const response = Object.create(Response);
			
			sut.get('/test',
				(req, res, next) => { req.data = before; next(); },
				queries,
				(req, _res, _next) => { resolve(req.data); }
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
			const sut = krauter(undefined);
			const request = Object.assign(Object.create(Request), {method: 'get', url: '/test'});
			const response = Object.create(Response);
			
			const before = 200;
			const number = 600;
			let after;
			
			sut.get('/test',
				(req, res, next) => { res.status(before); next(); },
				number,
				(req, res, _next) => { after = res.statusCode; }
			);
			
			sut(request, response, undefined);
			
			expect(after).to.equal(number);
		});
	});
});
