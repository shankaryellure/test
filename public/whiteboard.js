const socket = io();

  const newSessionButton = document.getElementById('newSessionBtn');
  if (newSessionButton) {
    newSessionButton.addEventListener('click', () => {
      socket.emit('createSession');
    });
  }

  socket.on('sessionCreated', (data) => {
    localStorage.setItem('sessionID', data.sessionId);
    document.cookie = `sessionID=${data.sessionId};path=/;max-age=3600;secure`;
  });


  const endSessionBtn = document.getElementById('endSession');
  const sessionId = localStorage.getItem('sessionID'); // Used by the host
  const guestName = localStorage.getItem('fullName'); // Used by the guest
  const guestSessionId = localStorage.getItem('guestSessionId'); // Session ID for guests
  
  if (endSessionBtn) {
      if (sessionId) { // Host logic
          endSessionBtn.addEventListener('click', () => {
              console.log("Host ending session", sessionId);
              socket.emit('endSession', { sessionId });
          });
      } else if (guestName && guestSessionId) { // Guest logic
          endSessionBtn.textContent = 'Leave Session';
          endSessionBtn.addEventListener('click', () => {
              console.log("Guest leaving session", guestName);
              socket.emit('leaveSession', { guestName, sessionId: guestSessionId });
          });
      }
  }
  
// When a session ends, clear sessionStorage and redirect
socket.on('sessionEnded', () => {
  localStorage.removeItem('sessionID');
  localStorage.removeItem('fullName');
  localStorage.removeItem('guestSessionId');
  window.location.href = '/login';
});

// When a guest leaves the session, handle redirection
socket.on('guestLeft', (data) => {
  if (data.guestName === guestName) {
      console.log("You have left the session");
      localStorage.removeItem('guestSessionId'); // Remove guestSessionId when the guest leaves
      window.location.href = '/index';
  }
});
  

  

socket.on('sessionPasscode', (passcode) => {
    const passcodeDisplayElement = document.getElementById('passcodeDisplay').textContent = passcode;

    if (passcodeDisplayElement) {
        passcodeDisplayElement.textContent = passcode;
    } else {
        console.error('Passcode display element not found on the page.');
    }
});

const joinSessionButton = document.getElementById('joinBtn');
const fullNameInput = document.getElementById('fullName');
const passcodeInput = document.getElementById('passcodeInput');

if (joinSessionButton) {
    joinSessionButton.addEventListener('click', () => {
        const fullName = fullNameInput.value;
        const passcode = passcodeInput.value;
        console.log("fullname",fullName);
        console.log("passcode",passcode);
        socket.emit('validatePasscode', { fullName, passcode });
    });
}

socket.on('passcodeValidationResult', (result) => {
    if (result.success) {
        localStorage.setItem('fullName', fullNameInput.value); // Store the fullName in localStorage
        localStorage.setItem('guestSessionId', result.sessionId); // Store the sessionId for the guest
        window.location.href = '/whiteboard?sessionId=' + result.sessionId;
    } else {
        alert('Failed to join session: ' + result.error);
    }
});

document.addEventListener('DOMContentLoaded', (event) => {
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', function() {
        fetch('/signout', {
          method: 'POST',
          credentials: 'include',
        })
        .then(response => {
          if (response.ok) {
            window.location.href = '/signin';
          } else {
            alert('Sign out failed.');
          }
        })
        .catch(error => {
          console.error('Error:', error);
        });
      });
    }
  });