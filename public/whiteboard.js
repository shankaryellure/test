const socket = io();

  const newSessionButton = document.getElementById('newSessionBtn');
  if (newSessionButton) {
    newSessionButton.addEventListener('click', () => {
      socket.emit('createSession');
    });
  }

// Correct event listener for the 'sessionPasscode' event in 'whiteboard.js'
socket.on('sessionPasscode', (passcode) => {
    const passcodeDisplayElement = document.getElementById('passcodeDisplay').textContent = passcode;

    if (passcodeDisplayElement) {
        passcodeDisplayElement.textContent = passcode;
    } else {
        console.error('Passcode display element not found on the page.');
    }
});

//Handling the joinBtn
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



socket.on('sessionFull', (message) => {
  alert(message); // Or update the UI to show that the session is full
});


//Listen for endSession button
document.addEventListener('DOMContentLoaded', (event) => {
    const endSessionButton = document.getElementById('endsession'); // Replace with your actual button ID  
    endSessionButton.addEventListener('click', function() {
      if (socket && sessionId) {
        socket.emit('endSession', { sessionId: sessionId });
      } else {
        console.error('Socket not connected or session ID undefined');
      }
    });
  });