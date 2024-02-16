const express = require('express');
const https = require('https');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql');
const db = require('./db');
const { captureRejectionSymbol } = require('events');
const app = express();
const server = require('http').createServer();
const combinedData = [];
const sessionCounts = {};



app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Load SSL certificate and key
const privateKeyPath = '/Users/shankaryellure/Desktop/test/sslcert/key.pem';
const certificatePath = '/Users/shankaryellure/Desktop/test/sslcert/cert.pem';
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const certificate = fs.readFileSync(certificatePath, 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Create an HTTPS server with your SSL certificates
const httpsServer = https.createServer(credentials, app);
const io = socketIo(httpsServer);


// // Hardcoded credentials (for initial testing only)
// const hardcodedEmail = 'abc@gmail.com';
// const hardcodedPassword = '123';

// Define a data structure to store drawing data for each session
const sessionDrawingData = {};

// Serve index page
app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// serve signup page
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});


//serve signing page
app.get('/signin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signin.html'));
  });

//serve signing page
app.get('/passcode', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'passcode.html'));
  });

  // Serve index page
  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  });

  //serve whiteboard page
  app.get('/whiteboard', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'whiteboard.html'));
  });


  // Route to handle user registration
  app.post('/signup', async (req, res) => {
    const { first_name, last_name, email, password, dob, gender } = req.body;
  
    // Check if email already exists
    const emailExistsQuery = 'SELECT email_id FROM new_users WHERE email_id = ?';
    db.query(emailExistsQuery, [email], (err, results) => {
      if (err) {
        // Handle database error
        return res.status(500).send('An error occurred during registration.');
      } else if (results.length > 0) {
        // Email already exists
        return res.send(`
          <script>
            alert("Email already exists. Please sign in.");
            window.location.href = "/signin";
          </script>
        `);
      } else {
        // Validate password complexity
        const passwordRegex = /^(?=.*[A-Za-z]{5,})(?=.*\d)(?=.*[@$!%*#?&]).{7,}$/;
        if (!passwordRegex.test(password)) {
          return res.status(400).send('Password does not meet the complexity requirementsPlease.');
        }
  
        // Hash the password before saving
        bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
          if (hashErr) {
            // Handle hashing error
            return res.status(500).send('An error occurred during registration.');
          }
  
          // Insert the new user into the new_users table with the hashed password
          const insertQuery = 'INSERT INTO new_users (first_name, last_name, email_id, password, date_of_birth, gender) VALUES (?, ?, ?, ?, ?, ?)';
          db.query(insertQuery, [first_name, last_name, email, hashedPassword, dob, gender], (insertErr, result) => {
            if (insertErr) {
              // Handle database insertion error
              return res.status(500).send('An error occurred during registration.');
            }
            
            // User registered successfully, redirect to the login page
            res.redirect('/login');
          });
        });
      }
    });
  });
  


// Route to handle login POST request
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Query to find the user by email
  const findUserQuery = 'SELECT * FROM new_users WHERE email_id = ?';
  db.query(findUserQuery, [email], (err, results) => {
    if (err) {
      // Handle database error
      res.status(500).send('An error occurred during login.');
    } else if (results.length === 0) {
      // No user found with that email
      res.status(401).send('No user found with that email.');
    } else {
      // User found, now compare the password
      const user = results[0];
      bcrypt.compare(password, user.password, (compareErr, isMatch) => {
        if (compareErr) {
          // Handle hashing error
          res.status(500).send('An error occurred during login.');
        } else if (!isMatch) {
          // Passwords do not match
          res.status(401).send('Invalid password.');
        } else {
          // Passwords match, proceed with session creation
          const sessionId = generateSessionId();
          const passcode = generatePasscode();

          // Store the session information in the database
          storePasscodeInDatabase(sessionId, passcode, (dbErr) => {
            if (dbErr) {
              // Handle error after attempting to store the session
              console.error("Error in storePasscodeInDatabase callback:", dbErr);
              res.status(500).send('Failed to initiate session.');
            } else {
              // After storing the session, redirect the user to the whiteboard page
              res.redirect(`/login?sessionId=${sessionId}&passcode=${passcode}`);
            }
          });
        }
      });
    }
  });
});
  

const generatePasscode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15);
}

  // Define storePasscodeInDatabase() according to your database logic
function storePasscodeInDatabase(sessionId, passcode, callback) {
  const query = 'INSERT INTO session_passcodes (session_id, passcode) VALUES (?, ?)';
  db.query(query, [sessionId, passcode], (err, result) => {
    callback(err);
  });
}

function isNewSession(sessionId, callback) {
  const query = 'SELECT * FROM session_passcodes WHERE session_id = ?';
  db.query(query, [sessionId], (err, results) => {
    if (err) {
      callback(err, null);
    } else {
      const isNew = results.length === 0;
      callback(null, isNew);
    }
  });
}




io.on('connection', (socket)=> {
   const sessionId = socket.id;

  // Listen for 'createSession' event from the client
  socket.on('createSession', () => {
    const sessionId = generateSessionId(); // Assuming this generates a unique ID for the session
    const passcode = generatePasscode(); // Generates a unique passcode for the session

    // Check if the session already exists in the database
    isNewSession(sessionId, (err, isNew) => {
      if (err) {
        // Handle error
        socket.emit('error', 'An error occurred while checking session status.');
      } else if (!isNew) {
        // If the session already exists, handle accordingly
        socket.emit('error', 'Session already exists.');
      } else {
        // If it's a new session, store it in the database
        storePasscodeInDatabase(sessionId, passcode, (dbErr) => {
          if (dbErr) {
            // Handle database error
            socket.emit('error', 'Failed to store session information.');
          } else {
            // Emit the session creation success back to the client
            socket.emit('sessionCreated', { sessionId, passcode });
          }
        });
      }
    });
  });

   // Handle passcode validation request for joining a session
   socket.on('validatePasscode', ({ fullname, passcode }) => { 
       const validationQuery = 'SELECT session_id FROM session_passcodes WHERE passcode = ?';
       db.query(validationQuery, [passcode], (err, results) => {
           if (err) {
               console.error('Error validating passcode:', err);
               socket.emit('passcodeValidationResult', { success: false, error: 'Database error' });
           } else if (results.length > 0) {
               const matchedSessionId = results[0].session_id;
                console.log("session matched");
         // Check if this is a new session and initialize count
         if (!sessionCounts[matchedSessionId]) {
           sessionCounts[matchedSessionId] = 0;
         }
         // Check if the session is full
         if (sessionCounts[matchedSessionId] >= 2) {
           // Session is full
           socket.emit('sessionFull', 'Session is full');
         } else {
           // Increment the count for the session
           sessionCounts[matchedSessionId]++;
           // Set the sessionId for the socket and allow the user to join the session
           socket.sessionId = matchedSessionId;
           socket.emit('passcodeValidationResult', { success: true, sessionId: matchedSessionId });
           socket.join(matchedSessionId); // This is assuming you're using Socket.IO rooms
         }
       } else {
         socket.emit('passcodeValidationResult', { success: false, error: 'Invalid passcode' });
       }
     });
   });
//   // Handle user disconnection
        socket.on('endSession', () => {
          console.log('A user disconnected');
          // Check if the session is complete (last connected user)
          const connectedUsers = Object.keys(io.sockets.sockets);
          if (connectedUsers.length === 0) {
               if (socket.sessionId && sessionCounts[socket.sessionId]) {
                     sessionCounts[socket.sessionId]--;
                   }

                //Save the combined drawing data as an HTML file for the session
                saveCombinedSessionDrawingAsHTML(sessionDrawingData);
                const deleteQuery = 'DELETE FROM session_passcodes WHERE session_id = ?';
                      db.query(deleteQuery, [socket.sessionId], (err, result) => {
                          if (err) {
                              console.error('Error deleting records:', err);
                          } else {
                              console.log(`Records deleted for session ID ${socket.sessionId}`);
                              // You can now do additional cleanup if needed
                          }
                      });
        }
   });
});






  const PORT = process.env.PORT || 3000; // Use port 443 for HTTPS
  const IP_ADDRESS = '10.111.118.73'; // Replace with your desired IP address

  httpsServer.listen(PORT, IP_ADDRESS, () => {
    console.log(`Secure server is running on ${IP_ADDRESS}:${PORT}`);
  });


  const saveDirectory = '/Users/shankaryellure/Desktop/whiteboardupdated/savedSessions'; // Replace with the actual path

  // Call this function when you want to save the drawing data for a session
  function saveCombinedSessionDrawingAsHTML(drawingData) {
    // Combine drawing data from all users
    const combinedData = [];
    for (const sessionId in drawingData) {
      if (drawingData[sessionId].drawingData) {
        combinedData.push(...drawingData[sessionId].drawingData);
      }
    }

    // Create an HTML string for the combined drawing data
    const canvasHTML = `<canvas id="whiteboard" width="800" height="400"></canvas>`;
    let drawingScript = `
      <script>
        const canvas = document.getElementById('whiteboard');
        const context = canvas.getContext('2d');
    `;

    // Generate JavaScript to replay the drawing
    combinedData.forEach((point) => {
      drawingScript += `
        context.beginPath();
        context.moveTo(${point.prevX}, ${point.prevY});
        context.lineTo(${point.x}, ${point.y});
        context.strokeStyle = '${point.color}';
        context.lineWidth = 2;
        context.stroke();
        context.closePath();
      `;
    });

    drawingScript += '</script>';

    const htmlContent = `<!DOCTYPE html><html><head><title>Session Drawing</title></head><body>${canvasHTML}${drawingScript}</body></html>`;

    // Save the HTML file for the session on the server
    const filePath = path.join(saveDirectory, 'Session.html');

    fs.writeFile(filePath, htmlContent, 'utf-8', (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log(`Drawing data saved as ${filePath}`);
      }
    });
  }