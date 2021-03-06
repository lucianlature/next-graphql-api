import fetchMock from 'fetch-mock';
import sinon from 'sinon';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

import CAPI from '../../../../server/lib/backend-adapters/capi';

const listOfTypeFixture = require('../../../fixtures/list-of-type-fixture.json');
const cachedSpy = () => sinon.spy((cacheKey, cacheTTL, value) => value());

describe('CAPI', () => {

	describe('#content', () => {

		before(() => {
			fetchMock.mock(
				new RegExp('https://[^/]*/v3_api_v2/item/_mget'),
				{
					docs: [
						{
							found: true,
							_source: { id: 'content-one' }
						},
						{
							found: true,
							_source: { id: 'content-two' }
						}
					]
				}
			);
		});

		after(() => {
			fetchMock.restore();
		});

		it('should be able to fetch content', () => {
			const cache = { cached: cachedSpy() };
			const capi = new CAPI(cache);

			return capi.content(['content-one', 'content-two'])
				.then(content => {
					content.should.have.length(2);
					content.should.eql([{ id: 'content-one' }, { id: 'content-two' }]);
				});
		});

		it('should use correct cache key and ttl', () => {
			const cached = cachedSpy();
			const cache = { cached };
			const capi = new CAPI(cache);

			return capi.content(['content-one', 'content-two'])
				.then(() => {
					cached.should.always.have.been.calledWith('capi.content.content-one,content-two', 60);
				});
		});

		it('should handle empty response from CAPI', () => {
			fetchMock.reMock(
				new RegExp('https://[^/]*/v3_api_v2/item/_mget'),
				{
					docs: []
				}
			);
			const cache = { cached: cachedSpy() };
			const capi = new CAPI(cache);

			return capi.content(['content-one', 'content-two'])
				.then(content => {
					content.should.have.length(0);
				});
		});

	});

	describe('#list', () => {
		const listUuid = '73667f46-1a55-11e5-a130-2e7db721f996';

		before(() => {
			fetchMock.mock(
				new RegExp(`https://[^\.]*.ft.com/lists/${listUuid}`),
				{ items: [{ id: 'content-one' }, { id: 'content-two' }] }
			);
		});

		after(() => {
			fetchMock.restore();
		});

		it('should be able to fetch list', () => {
			const cached = cachedSpy();
			const cache = { cached };
			const capi = new CAPI(cache);

			return capi.list(listUuid)
				.then(list => {
					list.items.should.have.length(2);
					list.items.should.deep.equal([{ id: 'content-one' }, { id: 'content-two' }]);
					cached.should.always.have.been.calledWith('capi.list.73667f46-1a55-11e5-a130-2e7db721f996', 60);
					// make sure mock was called
					fetchMock.called().should.be.true;
				});
		});

	});

	describe('#listOfType', () => {
		const listType = 'curatedTopStoriesFor';
		const concept = 'NzE=-U2VjdGlvbnM=';

		context('Successful response', () => {

			before(() => {
				fetchMock.mock(
					new RegExp('https://[^\.]*.ft.com/lists'),
					listOfTypeFixture
				);
			});

			after(() => {
				fetchMock.restore();
			});

			it('should be able to fetch a listType', () => {
				const cached = cachedSpy();
				const cache = { cached };
				const capi = new CAPI(cache);

				return capi.listOfType(listType, concept)
				.then(list => {
					list.items.should.have.length(6);
					list.title.should.equal('Test TopStories List for Markets stream');
					cached.should.always.have.been.calledWith(`capi.list-of-type.${listType}.${concept}`, 60);
					// make sure mock was called
					fetchMock.called().should.be.true;
				});
			});

		});

		context('Unsuccessful response', () => {

			before(() => {
				fetchMock.mock(
					new RegExp('https://[^\.]*.ft.com/lists'),
					{ status: 404, body: 'Not Found'}
				);
			});

			after(() => {
				fetchMock.restore();
			});

			it('should gracefully handle getting no response from capi', () => {
				const cached = cachedSpy();
				const cache = { cached };
				const capi = new CAPI(cache);

				return capi.listOfType(listType, concept).should.be.rejectedWith('COCO list-of-type responded with "Not Found" (404)')
			});

		});

	});

	describe('#search', () => {

		before(() => {
			fetchMock.mock(
				new RegExp('https://[^/]*/v3_api_v2/item/_search'),
				{
					hits: {
						total: 1,
						hits: [
							{
								_source: {
									id: 'content-one'
								}
							}
						]
					}
				}
			);
		});

		after(() => {
			fetchMock.restore();
		});

		it('should be able to fetch content', () => {
			const cache = {cached: cachedSpy()};
			const capi = new CAPI(cache);

			return capi.search('metadata.idV1', 'topicId', { limit: 50, since: '2016-03-21' })
				.then(content => {
					content.should.eql([{ id: 'content-one' }]);
				});
		});

		it('should use correct cache key and ttl when a single conceptID is specified', () => {
			const cached = cachedSpy();
			const cache = {cached};
			const capi = new CAPI(cache);

			return capi.search('metadata.idV1', 'topicId', { limit: 50, since: '2016-03-21' })
				.then(() => {
					cached.should.always.have.been.calledWith('capi.search:metadata.idV1=topicId:limit=50:since=2016-03-21', 600);
				});
		});

		it('should use correct cache key and ttl when multiple conceptIDs are specified', () => {
			const cached = cachedSpy();
			const cache = {cached};
			const capi = new CAPI(cache);

			return capi.search('metadata.idV1', ['topicId1', 'topicId2', 'topicId3'], { limit: 50, since: '2016-03-21' })
				.then(() => {
					cached.should.always.have.been.calledWith('capi.search:metadata.idV1=topicId1,topicId2,topicId3:limit=50:since=2016-03-21', 600);
				});
		});

		it('should handle empty response from CAPI', () => {
			fetchMock.reMock(
				new RegExp('https://[^/]*/v3_api_v2/item/_search'),
				{
					hits: {
						total: 0,
						hits: []
					}
				}
			);
			const cache = {cached: cachedSpy()};
			const capi = new CAPI(cache);

			return capi.search('metadata.idV1', 'topicId', { limit: 50, since: '2016-03-21' })
				.then(content => {
					content.should.eql([]);
				});
		});

	});

	describe('#searchCount', () => {

		before(() => {
			fetchMock.mock(
				new RegExp('https://[^/]*/v3_api_v2/item/_search'),
				{
					hits: {
						total: 3,
						hits: [
							{
								_source: {
									id: 'content-one'
								}
							},
							{
								_source: {
									id: 'content-two'
								}
							},
							{
								_source: {
									id: 'content-three'
								}
							}
						]
					}
				}
			);
		});

		after(() => {
			fetchMock.restore();
		});

		it('should be able to fetch content', () => {
			const cache = {cached: cachedSpy()};
			const capi = new CAPI(cache);

			return capi.searchCount('metadata.idV1', 'topicId', { since: '2016-03-21' })
				.then(count => {
					count.should.eql(3);
				});
		});

		it('should use correct cache key and ttl when a single conceptID is specified', () => {
			const cached = cachedSpy();
			const cache = {cached};
			const capi = new CAPI(cache);

			return capi.searchCount('metadata.idV1', 'topicId', { since: '2016-03-21' })
				.then(() => {
					cached.should.always.have.been.calledWith('capi.search-count:metadata.idV1=topicId:since=2016-03-21', 600);
				});
		});

		it('should use correct cache key and ttl when multiple conceptIDs are specified', () => {
			const cached = cachedSpy();
			const cache = {cached};
			const capi = new CAPI(cache);

			return capi.searchCount('metadata.idV1', ['topicId1', 'topicId2', 'topicId3'], { since: '2016-03-21' })
				.then(() => {
					cached.should.always.have.been.calledWith('capi.search-count:metadata.idV1=topicId1,topicId2,topicId3:since=2016-03-21', 600);
				});
		});

		it('should handle empty response from CAPI', () => {
			fetchMock.reMock(
				new RegExp('https://[^/]*/v3_api_v2/item/_search'),
				{
					hits: {
						total: 0,
						hits: []
					}
				}
			);
			const cache = {cached: cachedSpy()};
			const capi = new CAPI(cache);

			return capi.searchCount('metadata.idV1', 'topicId', { since: '2016-03-21' })
				.then(count => {
					count.should.eql(0);
				});
		});

	});

});
