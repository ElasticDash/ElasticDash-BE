import { pool } from '../../postgres';

export const acceptSqlQuery = async (query, myId) => {
    console.log('acceptSqlQuery is triggered with query: ', query);
    console.log('myId: ', myId);
    const lowerQuery = query.toLowerCase().split(';')[0].split('\n')[0].trim();
    const forbiddenWords = ['delete', 'update', 'insert', 'drop', 'alter', 'create', 'truncate', 'exec', 'execute'];
    for (const word of forbiddenWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'i'); // Match whole words only, case-insensitive
        if (regex.test(lowerQuery)) {
            return 403;
        }
    }

    query = query.replaceAll('CURRENT_USER_ID', myId ? myId.toString() : 'NULL');

    console.log('Executing SQL query: ', query);

    return pool.query(query)
    .then(res => {
        return {
            rows: res.rows,
            rowCount: res.rowCount
        };
    })
    .catch(err => {
        console.error('SQL query error: ', err);
        throw err;
    });
}
