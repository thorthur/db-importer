const inquirer = require('inquirer');
const fse = require('fs-extra');
const lodash = require('lodash');

const log = require('./lib/log');
const cst = require('./constants');

const inquiries = cst.inquiries;

const checkChoice = value => ({
    value,
    checked: true
});
const uncheckChoice = value => ({
    value,
    checked: false
});

/**
 * create configuration with configuration file's values if present
 * make related prompts to be skipped
 *
 * @resolves configuration object
 */
const init = () => fse.readJson(cst.configFile)
    .then((config) => {
        // disable prompts for items specified by the configuration file
        lodash.forEach(config, (value, key) => {
            if (inquiries[key]) {
                /**
                 * validate returns true or the error message and a non empty string is considered truthy
                 * I am so sorry, I have no other choice than to compare to true
                 * warn user if the item is invalid, disable prompt if it isn't
                 */
                if (typeof (inquiries[key].validate) === 'function' && inquiries[key].validate(config[key]) !== true) {
                    log.warning(`${cst.configFile} "${key}": "${value}" ${inquiries[key].validate(config[key])}`);
                } else {
                    inquiries[key].when = false;
                }
            } else {
                log.warning(`${key} is defined in ${cst.configFile} but is not a valid configuration item`);
            }
        });
        lodash.forEach(inquiries, (prompt) => {
            if (typeof (prompt.default) === 'function') {
                /**
                 * inquirer won't have access to the configuration file, we must thus manually run the default functions
                 */
                prompt.default = prompt.default(config) || prompt.default;
            }
        });
        log.info(`${cst.configFile} has been loaded`);
        return config;
    })
    .catch((error) => {
        if (error.errno === -2) {
            log.info(cst.messages.noConfig);
        } else {
            log.failure(error);
        }
        return {}; // if an error occurs, loads nothing.
    });

const askCredentials = () => inquirer.prompt([
    inquiries.dbms,
    inquiries.host,
    inquiries.port,
    inquiries.user,
    inquiries.password,
    inquiries.schema
]);

const selectEntities = (session) => {
    const results = session.results;

    let choices = [];


    const tables = results.tables.map(checkChoice);
    const twoTypeJunction = results.twoTypeJunction.map(uncheckChoice);
    const jhipster = results.jhipster.map(uncheckChoice);
    const liquibase = results.liquibase.map(uncheckChoice);

    choices.push(new inquirer.Separator(cst.headers.tables));
    choices = choices.concat(tables);

    choices.push(new inquirer.Separator(cst.headers.twoTypeJunction));
    choices = choices.concat(twoTypeJunction);

    choices.push(new inquirer.Separator(cst.headers.jhipster));
    choices = choices.concat(jhipster);

    choices.push(new inquirer.Separator(cst.headers.liquibase));
    choices = choices.concat(liquibase);

    inquiries.entities.choices = choices;

    return inquirer.prompt(inquiries.entities).then(answers => Object.assign(session, answers));
};

module.exports = {
    init,
    askCredentials,
    selectEntities
};
