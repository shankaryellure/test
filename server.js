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
const cookieParser = require('cookie-parser');
app.use(cookieParser());
const session = require('express-session');
const cookie = require('cookie');



app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'public'))); 

// Load SSL certificate and key
const privateKeyPath = '/Users/shankaryellure/Desktop/test/sslcert/key.pem';
const certificatePath = '/Users/shankaryellure/Desktop/test/sslcert/cert.pem';
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const certificate = fs.readFileSync(certificatePath, 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Create an HTTPS server with your SSL certificates
const httpsServer = https.createServer(credentials, app);
const io = socketIo(httpsServer);

app.use(session({
  secret: 'mySecretKey',
  resave: true,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: true, // set to true if using https
  }
}));


// Define a data structure to store drawing data for each session
const sessionDrawingData = {};

// Serve index page
  app.get('/index', checkSession, (req, res) => {
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
  app.get('/passcode',(req, res) => {
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
  
    // Checking if email already exists
    const emailExistsQuery = 'SELECT email_id FROM new_users WHERE email_id = ?';
    db.query(emailExistsQuery, [email], (err, results) => {
      if (err) {
        return res.status(500).send('An error occurred during registration.');
      } else if (results.length > 0) {
        return res.send(`
          <script>
            alert("Email already exists. Please sign in.");
            window.location.href = "/signin";
          </script>
        `);
      } else {
        const passwordRegex = /^(?=.*[A-Za-z]{5,})(?=.*\d)(?=.*[@$!%*#?&]).{7,}$/;
        if (!passwordRegex.test(password)) {
          return res.status(400).send('Password does not meet the complexity requirementsPlease.');
        }
          bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
          if (hashErr) {
            return res.status(500).send('An error occurred during registration.');
          }
            const insertQuery = 'INSERT INTO new_users (first_name, last_name, email_id, password, date_of_birth, gender) VALUES (?, ?, ?, ?, ?, ?)';
          db.query(insertQuery, [first_name, last_name, email, hashedPassword, dob, gender], (insertErr, result) => {
            if (insertErr) {
              return res.status(500).send('An error occurred during registration.');
            }
                        res.redirect('/signin');
          });
        });
      }
    });
  });
  


// Route to handle login POST request
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const findUserQuery = 'SELECT * FROM new_users WHERE email_id = ?';
  db.query(findUserQuery, [email], (err, results) => {
    if (err) {
      return res.status(500).send('An error occurred during login.');
    }
    if (results.length === 0) {
      return res.status(401).send('No user found with that email.');
    }
    const user = results[0];
    bcrypt.compare(password, user.password, (compareErr, isMatch) => {
      if (compareErr) {
        return res.status(500).send('An error occurred during login.');
      }
      if (!isMatch) {
        return res.status(401).send('Invalid password.');
      }
      const sessionToken = generateSessionId();
      const userId = user.id; 
      const userEmail = user.email_id; 

      const insertSessionQuery = 'INSERT INTO active_sessions (session_id, host_id, email, start_time, end_time) VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY))';

      db.query(insertSessionQuery, [sessionToken, userId, userEmail], (err, result) => {
        if (err) {
          return res.status(500).send('An error occurred during session creation.');
        }
        res.cookie('userSessionId', sessionToken, { httpOnly: true, secure: true, maxAge: 24 * 60 * 60 * 1000 });
        res.redirect('/login'); 
      });
    });
  });
});


function checkSession(req, res, next) {
  const sessionId = req.cookies.userSessionId;
  if (!sessionId) {
    console.log("No session ID found in cookie.");
    return res.redirect('/signin');
  }

  const findSessionQuery = 'SELECT host_id FROM active_sessions WHERE session_id = ? AND end_time > NOW()';
  db.query(findSessionQuery, [sessionId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error checking session.');
    }
    if (results.length === 0) {
      console.log("Session ID not recognized or expired.");
      return res.redirect('/signin');
    }
    console.log("User is authenticated with session ID:", sessionId);
    req.session.user = { id: results[0].host_id };
    return res.redirect('/login');
  });
}

const generatePasscode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15);
}

  function storePasscodeInDatabase(sessionId, passcode, hostId, email, callback) {
    const query = 'INSERT INTO session_passcodes (session_id, passcode, host_id, email) VALUES (?, ?, ?, ?)';
    db.query(query, [sessionId, passcode, hostId, email], (err, result) => {
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

app.post('/signout', (req, res) => {
  const sessionId = req.cookies['userSessionId'];

  const deleteSessionQuery = 'DELETE FROM active_sessions WHERE session_id = ?';
  db.query(deleteSessionQuery, [sessionId], (err, result) => {
    if (err) {
      res.status(500).send('Error signing out. Please try again.');
    } else {
      res.clearCookie('userSessionId');
      res.status(200).send('Signed out successfully.');
    }
  });
});


io.on('connection', (socket)=> {
  
  // Listen for 'createSession' event from the client
  socket.on('createSession', () => {
    const sessionId = generateSessionId(); 
    const passcode = generatePasscode(); 
    console.log("sessionId inside the createSession,",sessionId);
    isNewSession(sessionId, (err, isNew) => {
      if (err) {
        socket.emit('error', 'An error occurred while checking session status.');
      } else if (!isNew) {
        socket.emit('error', 'Session already exists.');
      } else {
        const cookieString = socket.handshake.headers.cookie;
        const cookies = cookie.parse(cookieString || '');
        const cookieSessionId = cookies['userSessionId'];
        console.log("cookieSessionId",cookieSessionId);
  
        const findSessionDetailsQuery = 'SELECT host_id, email FROM active_sessions WHERE session_id = ?';
        db.query(findSessionDetailsQuery, [cookieSessionId], (findErr, sessionDetails) => {
          if (findErr || sessionDetails.length === 0) {
            socket.emit('error', 'Failed to retrieve session details.');
          } else {
            const hostId = sessionDetails[0].host_id;
            const email = sessionDetails[0].email;
            console.log("hostId and email",hostId , email);
  
            storePasscodeInDatabase(sessionId, passcode, hostId, email, (dbErr) => {
              if (dbErr) {
                socket.emit('error', 'Failed to store session information.');
              } else {
                console.log("before sessionCreated is emitting",sessionId,passcode);
                socket.emit('sessionCreated', { sessionId, passcode });
                console.log("after sessionCreated is emitting",sessionId,passcode);

              }
            });
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
                console.log("session matched", matchedSessionId);
         if (!sessionCounts[matchedSessionId]) {
           sessionCounts[matchedSessionId] = 0;
         }
         if (sessionCounts[matchedSessionId] >= 2) {
           socket.emit('sessionFull', 'Session is full');
         } else {
           sessionCounts[matchedSessionId]++;
           socket.sessionId = matchedSessionId;
           console.log("socket.sessionID",socket.sessionId);
           socket.emit('passcodeValidationResult', { success: true, sessionId: matchedSessionId });
           socket.join(matchedSessionId); 
         }
       } else {
         socket.emit('passcodeValidationResult', { success: false, error: 'Invalid passcode' });
       }
     });
   });


   socket.on('endSession', (data) => {
    console.log('A user requested to end the session');
    const { sessionId } = data;
    console.log("sessionId in the endSession",sessionId);
    if (!sessionId) {
      console.log('No session ID associated with this socket.');
      return;
    }

    const findHostAndEmailQuery = 'SELECT host_id, email FROM session_passcodes WHERE session_id = ?';
    db.query(findHostAndEmailQuery, [sessionId], (err, results) => {
      if (err) {
        console.error('Error fetching host_id and email:', err);
        return;
      }
      if (results.length === 0) {
        console.log('No matching session found to end.');
        return;
      }

      const hostId = results[0].host_id;
      const email = results[0].email;

      const deleteSessionQuery = 'DELETE FROM session_passcodes WHERE host_id = ? AND email = ?';
      db.query(deleteSessionQuery, [hostId, email], (deleteErr, deleteResult) => {
        if (deleteErr) {
          console.error('Error deleting session:', deleteErr);
          return;
        }
        console.log(`Session ended and deleted for host_id ${hostId} and email ${email}`);
      });
    });
  });
});





  const PORT = process.env.PORT || 3000; 
  const IP_ADDRESS = '10.111.118.73'; 

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