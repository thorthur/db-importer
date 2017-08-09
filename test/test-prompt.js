const assert = require('assert');
const sinon = require('sinon');
const inquirer = require('inquirer');
const joi = require('joi');
const lodash = require('lodash');
const fse = require('fs-extra');

const prompt = require('../prompt');
const log = require('../lib/log');
const cst = require('../constants');

const sandbox = sinon.sandbox.create();
const inquiries = cst.inquiries;

describe('prompt', function () {
    afterEach(function () {
        sandbox.restore();
    });

    describe('askCredentials', function () {
        it('is called with expected arguments', function () {
            // This replaces the function inquirer.prompt with a stub.
            const stub = sandbox.stub(inquirer, 'prompt');

            prompt.askCredentials();

            assert.deepEqual(stub.getCall(0).args[0], [
                inquiries.dbms,
                inquiries.host,
                inquiries.port,
                inquiries.user,
                inquiries.password,
                inquiries.schema
            ]);
        });
    });

    describe('init', function () {
        let fseMock;
        let logMock;

        beforeEach(function () {
            fseMock = sandbox.mock(fse);
            logMock = sandbox.mock(log);
        });

        afterEach(function () {
            logMock.verify();
        });

        it('informs when there is no configuration file and resolves an empty object', function () {
            fseMock.expects('readJson').rejects({ errno: -2 });

            logMock.expects('info').once().withArgs(cst.messages.noConfig);

            return prompt.init().then((config) => {
                assert.deepEqual(config, {});
            });
        });

        it('prints the error message when there is one and resolves an empty object', function () {
            const dummyError = {};
            fseMock.expects('readJson').rejects(dummyError);
            logMock.expects('failure').once().withArgs(dummyError);

            return prompt.init().then((config) => {
                assert.deepEqual(config, {});
            });
        });

        it('disables prompts for specified items, resolves found configuration object and inform user', function () {
            const dummyConfig = {
                dbms: 'mysql',
                host: '127.0.0.1',
                port: '3306',
                user: 'dev',
                password: 'password',
                schema: 'schema'
            };
            fseMock.expects('readJson').resolves(dummyConfig);
            logMock.expects('info').once().withArgs(cst.messages.foundConfig);

            return prompt.init().then((config) => {
                lodash.forEach(dummyConfig, (value, key) => {
                    assert.equal(cst.inquiries[key].when, false, `expects cst.inquiries[${key}].when to be false`);
                });
                assert.equal(config, dummyConfig);
            });
        });

        it('warns user if provided item isn\'t valid', function () {
            const dummyConfig = {
                dbm: 'mysql'
            };
            fseMock.expects('readJson').resolves(dummyConfig);
            const warningMessage = `dbm is defined in ${cst.configFile} but is not a valid configuration item`;
            logMock.expects('warning').once().withArgs(warningMessage);
            logMock.expects('info').once();

            return prompt.init();
        });

        it('warns user if provided item value doesn\'t pass validation', function () {
            const dummyConfig = {
                port: '-'
            };
            fseMock.expects('readJson').resolves(dummyConfig);
            const warningMessage = `${cst.configFile} "port": "-" ${inquiries.port.validate('-')}`;
            logMock.expects('warning').once().withArgs(warningMessage);
            logMock.expects('info').once();

            return prompt.init();
        });

        it('lets current default if it cannot deduce one from configuration', function () {
            const dummyConfig = {};
            fseMock.expects('readJson').resolves(dummyConfig);
            logMock.expects('info').once();

            // we force this enquiry to return null
            const backupDefault = cst.inquiries.port.default;
            const dummyDefault = () => null;
            cst.inquiries.port.default = dummyDefault;

            return prompt.init().then(() => {
                try {
                    assert.equal(cst.inquiries.port.default, dummyDefault);
                } finally {
                    cst.inquiries.port.default = backupDefault;
                }
            });
        });
    });
});
