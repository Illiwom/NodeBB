// disclosure: used ChatGPT to help write the test cases

'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');

const plugins = require('../../src/plugins');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const user = require('../../src/user');

describe('Topic Events', () => {
    let fooUid;
    let topic;
    before(async () => {
        fooUid = await user.create({ username: 'foo', password: '123456' });

        const categoryObj = await categories.create({
            name: 'Test Category',
            description: 'Test category created by testing script',
        });
        topic = await topics.post({
            title: 'topic events testing',
            content: 'foobar one two three',
            uid: fooUid,
            cid: 1,
        });
    });

    describe('.init()', () => {
        before(() => {
            topics.events._ready = false;
        });

        it('should allow a plugin to expose new event types', async () => {
            await plugins.hooks.register('core', {
                hook: 'filter:topicEvents.init',
                method: async ({ types }) => {
                    types.foo = {
                        icon: 'bar',
                        text: 'baz',
                        quux: 'quux',
                    };

                    return { types };
                },
            });

            await topics.events.init();

            assert(topics.events._types.foo);
            assert.deepStrictEqual(topics.events._types.foo, {
                icon: 'bar',
                text: 'baz',
                quux: 'quux',
            });
        });
    });

    describe('.log()', () => {
        it('should log and return a set of new events in the topic', async () => {
            const events = await topics.events.log(topic.topicData.tid, {
                type: 'foo',
            });

            assert(events);
            assert(Array.isArray(events));
            events.forEach((event) => {
                assert(['id', 'icon', 'text', 'timestamp', 'timestampISO', 'type', 'quux'].every(key => event.hasOwnProperty(key)));
            });
        });
    });

    describe('.get()', () => {
        it('should get a topic\'s events', async () => {
            const events = await topics.events.get(topic.topicData.tid);

            assert(events);
            assert(Array.isArray(events));
            assert.strictEqual(events.length, 1);
            events.forEach((event) => {
                assert(['id', 'icon', 'text', 'timestamp', 'timestampISO', 'type', 'quux'].every(key => event.hasOwnProperty(key)));
            });
        });
    });

    describe('.purge()', () => {
        let eventIds;

        before(async () => {
            const events = await topics.events.get(topic.topicData.tid);
            eventIds = events.map(event => event.id);
        });

        it('should purge topic\'s events from the database', async () => {
            await topics.events.purge(topic.topicData.tid);

            const keys = [`topic:${topic.topicData.tid}:events`];
            keys.push(...eventIds.map(id => `topicEvent:${id}`));

            const exists = await Promise.all(keys.map(key => db.exists(key)));
            assert(exists.every(exists => !exists));
        });


        // disclosure: used ChatGPT to help write the test cases


        // my test 1
        it('Should handle non-existent topic gracefully', async () => {
            const nonExistentTopicId = 'nonExistentTopicId';
            await assert.doesNotReject(async () => {
                await topics.events.purge(nonExistentTopicId);
            });
        });

        // my test 2
        it('Should be idempotent', async () => {
            await topics.events.purge(topic.topicData.tid);
            await topics.events.purge(topic.topicData.tid); // Second call

            const keys = [`topic:${topic.topicData.tid}:events`];
            const exists = await Promise.all(keys.map(key => db.exists(key)));
            assert(exists.every(exists => !exists));
        });

        // my test 3
        it('Should result in zero events for the topic', async () => {
            await topics.events.purge(topic.topicData.tid);

            const eventsAfterPurge = await topics.events.get(topic.topicData.tid);
            assert.strictEqual(eventsAfterPurge.length, 0);
        });

        // my test 4
        it('Should purge all events when no event IDs are provided', async () => {
            await topics.events.purge(topic.topicData.tid);

            const eventsAfterPurge = await topics.events.get(topic.topicData.tid);
            assert.strictEqual(eventsAfterPurge.length, 0, 'All events should be purged when no event IDs are provided');
        });

        // my test 5
        it('Should only purge specified events when provided with event IDs', async () => {
            const subsetEventIds = eventIds.slice(0, 2); // Assuming eventIds is an array with at least 2 elements
            await topics.events.purge(topic.topicData.tid, subsetEventIds);

            const remainingEvents = await topics.events.get(topic.topicData.tid);
            assert(subsetEventIds.every(id => !remainingEvents.includes(id)), 'Only specified events should be purged');
        });
    });
});
