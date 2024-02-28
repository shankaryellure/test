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
  if (endSessionBtn) {
    endSessionBtn.addEventListener('click', () => {
        socket.emit('endSession', { sessionId: localStorage.getItem('sessionID') });
      window.location.href = '/login'; 
    });
  }

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
        socket.emit('validatePasscode', { fullName, passcode });
    });
}

socket.on('passcodeValidationResult', (result) => {
    if (result.success) {
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