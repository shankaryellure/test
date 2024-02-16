const mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root', // replace with your MySQL username
  password: 'Tillu@122', // replace with your MySQL password
  database: 'whiteboard' // replace with your database name
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the DB');
});

module.exports = connection;

if (typeof callback === 'function') {
  // It's safe to call the callback function
  callback({ success: false, error: err });
} else {
  // Handle the error differently or log that callback was not a function
}