/**
 * @file MSSQL constants
 */


/**
 * Name of the database that stores information about
 * all the other databases maintained by the MSSQL server.
 *
 * @constant {string}
 * @see {@link https://docs.microsoft.com/fr-fr/sql/relational-databases/system-information-schema-views/system-information-schema-views-transact-sql|MSSQL doc}
 */
const metaDatabase = 'INFORMATION_SCHEMA';

/**
 * Values used to map results when retrieving tables
 *
 * @enum {string}
 */
const fields = {
    tableName: 'TABLE_NAME'
};


module.exports = {
    metaDatabase,
    fields
};
