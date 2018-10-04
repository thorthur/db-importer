
/**
 * @file Core functions for connection and processing of data
 * retrieved from a MSSQL server
 *
 * We promisify some mssql methods in order to be able to wait for their execution
 * and handle any error thrown.
 * If we don't, we can't catch the errors before doing further operations.
 *
 * We need to do it manually because mssql doesn't respect node conventions:
 * the callback is always called, with an error of null or undefined value in case of success.
 */

const lodash = require('lodash');
const mssql = require('mssql');
const mysql = require('mysql');

const cst = require('./constants');
const db = require('../db-constants');
const queries = require('./queries');


/**
 * Open a mssql connection, in a promisified way.
 *
 * @param {Object} session - Object containing the necessary fields to connect to a database : {dbms, host, port, user, password}
 * @returns {Promise} Whether or not the connection to the mssql server succeeded
 */
const connect = (session) => {
    const config = {
      user: session.user,
      password: session.password,
      server: session.host,
      port: session.port
    }

    return new Promise((resolve, reject) => {
        mssql.connect(config)
          .then(pool => {
            return resolve();
          })
          .catch(error => {
                error.brokenSession = session;
                return reject(error);
          })
    });
};


/**
 * Close a mssql connection, in a somewhat promisified way
 *
 * @param session - The current client's mssql session
 * @returns {Promise} Whether or not the connection closed
 */
const close = session => new Promise((resolve, reject) => {
        mssql.close();
        return resolve();
    });


/**
 * From a connection to a mssql database,
 * return tables as a list
 *
 * @param session - The current client's mssql session
 * @returns {Promise}
 */
const entityCandidates = (session) => {
    /**
     * promisified version of session.query
     *
     * @param store - the session.results property it will use to store results.
     * @param query - the query it must run
     * @returns {Promise}
     */
    const promisedQuery = (store, query) => new Promise((resolve, reject) => {
        // pass the SQL query
        const request = new mssql.Request();
        console.log(" ** query");
        console.log(query);
        request.query(query, (error, results) => {
            if (error) {
                return reject(error);
            }
            // store results as an array of strings
            console.log(" ** results");
            console.log(results);
            session.results[store] = lodash.map(results.recordset, cst.fields.tableName);

            console.log(" ** store");
            console.log(session.results);
            return resolve();
        });
    });

    const schema = mysql.escape(session.schema);
    const jhipsterQuery = queries.jhipster(schema);
    const liquibaseQuery = queries.liquibase(schema);

    return promisedQuery(db.FIELDS.jhipster, jhipsterQuery)
        .then(() => promisedQuery(db.FIELDS.liquibase, liquibaseQuery))
        .then(() => {
            // filter tables we don't want to query
            const filter = mysql.escape(lodash.flatten(lodash.values(session.results)));
            const twoTypeJunctionQuery = queries.twoTypeJunction(schema, filter);

            return promisedQuery(db.FIELDS.twoTypeJunction, twoTypeJunctionQuery);
        })
        .then(() => {
            // filter tables we don't want to query
            const filter = mysql.escape(lodash.flatten(lodash.values(session.results)));
            const tablesQuery = queries.tables(schema, filter);

            return promisedQuery(db.FIELDS.tables, tablesQuery);
        });
};


/**
 * Use the raw query results of mssql to create an object representing the database structure.
 * This function returns an object with as many properties as there are tables.
 * Each table is an array of objects, each one of these objects represents a column.
 *
 * @param { Object[] } queryResults - an array of RowDataPacket objects, the output of queries.allColumns (see .entityCandidatesColumns)
 * @returns { Object } the returned object has this structure : { table_name: { column_name: { column properties } } }
 */
const organizeColumns = (queryResults) => {
    const result = {};

    // modify this loop to add more column values
    queryResults.forEach((queryResult) => {
        const tableName = queryResult.table_name;
        const columnName = queryResult.column_name;
        const ordinalPosition = queryResult.ordinal_position;
        const columnType = queryResult.data_type;

        const columnProperties = {
            ordinalPosition,
            columnType
        };

        // initialise result.tableName if it doesn't exist yet
        result[tableName] = result[tableName] || {};
        result[tableName][columnName] = columnProperties;
    });

    return result;
};


/**
 * Pass a query to get the data needed for mapping the columns,
 * then organize the data (organizeColumns) and update the session.entities object with them.
 *
 * @param {Object} session - the current user session
 */
const entityCandidatesColumns = (session) => {
    const promisedQuery = query => new Promise((resolve, reject) => {
        const tables = session.entities;

        // pass the SQL query
        const request = new mssql.Request();
        console.log(" ** query");
        console.log(query);
        request.query(query, (error, results) => {
            if (error) {
                return reject(error);
            }

            // update the session entities
            console.log(" ** results");
            console.log(results);
            session.entities = organizeColumns(results.recordset);

            console.log(" ** entities");
            console.log(session.results);
            return resolve(session);
        });
    });

    const schema = mysql.escape(session.schema);
    const tables = mysql.escape(session.entities);
    const columnsSelectionQuery = queries.allColumns(schema, tables);

    return promisedQuery(columnsSelectionQuery);
};


module.exports = {
    connect,
    close,
    entityCandidates,
    entityCandidatesColumns,
    organizeColumns
};
