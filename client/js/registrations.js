// Registrations management functionality with workout dropdown
Auth.redirectIfNotLoggedIn();
Auth.displayUserInfo();

// Global variables
let editingRegistrationId = null;
let trainees = [];
let workouts = [];

// Logout handler
document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    Auth.logout();
});

// Load registrations and related data
async function loadRegistrations() {
    try {
        const registrations = await api.getRegistrations();
        displayRegistrations(registrations);
    } catch (error) {
        console.error('Error loading registrations:', error);
        showError('Error loading registrations: ' + error.message);
    }
}

async function loadTrainees() {
    try {
        // Get a large number of trainees for the dropdown
        const response = await api.getTrainees(1, 100);
        trainees = response.data;
        populateTraineeSelect();
    } catch (error) {
        console.error('Error loading trainees:', error);
        showError('Error loading trainees: ' + error.message);
    }
}

async function loadWorkouts() {
    try {
        workouts = await api.getWorkouts();
        populateWorkoutSelect();
    } catch (error) {
        console.error('Error loading workouts:', error);
        showError('Error loading workouts: ' + error.message);
    }
}

function populateTraineeSelect() {
    const select = document.getElementById('registration-trainee');
    select.innerHTML = '<option value="">Select a trainee...</option>';

    trainees.forEach(trainee => {
        const option = document.createElement('option');
        option.value = trainee.id;
        option.textContent = `${trainee.name} (${trainee.email})`;
        select.appendChild(option);
    });
}

function populateWorkoutSelect() {
    const select = document.getElementById('registration-workout');
    select.innerHTML = '<option value="">Select a workout...</option>';

    workouts.forEach(workout => {
        const option = document.createElement('option');
        option.value = workout.id;
        option.textContent = workout.name;
        option.dataset.duration = workout.duration;
        option.dataset.description = workout.description || '';
        option.dataset.color = workout.color || '';
        select.appendChild(option);
    });
}

function displayWorkoutDetails(workoutId) {
    const detailsDiv = document.getElementById('workout-details');

    if (!workoutId) {
        detailsDiv.style.display = 'none';
        return;
    }

    const workout = workouts.find(w => w.id === workoutId);
    if (!workout) {
        detailsDiv.style.display = 'none';
        return;
    }

    const colorStyle = workout.color ? `color: ${workout.color}; font-weight: bold;` : '';

    detailsDiv.innerHTML = `
        <h4 style="${colorStyle}">${workout.name}</h4>
        <p><span class="workout-duration">Duration: ${workout.duration} minutes</span></p>
        ${workout.description ? `<p>Description: ${workout.description}</p>` : ''}
    `;
    detailsDiv.style.display = 'block';

    // Auto-calculate end time if start time is set
    calculateEndTime();
}

function calculateEndTime() {
    const workoutSelect = document.getElementById('registration-workout');
    const startTimeInput = document.getElementById('registration-start');
    const endTimeInput = document.getElementById('registration-end');

    const selectedWorkout = workouts.find(w => w.id === workoutSelect.value);
    const startTime = startTimeInput.value;

    if (selectedWorkout && startTime && !endTimeInput.value) {
        const start = new Date(startTime);
        const end = new Date(start.getTime() + selectedWorkout.duration * 60000); // Convert minutes to milliseconds
        endTimeInput.value = formatDateTimeLocal(end);
    }
}

function getWorkoutNameById(workoutId) {
    const workout = workouts.find(w => w.id === workoutId);
    return workout ? workout.name : workoutId;
}

function displayRegistrations(registrations) {
    const tbody = document.getElementById('registrations-tbody');

    if (registrations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No registrations found</td></tr>';
        return;
    }

    tbody.innerHTML = registrations.map(registration => `
        <tr>
            <td>${registration.trainee.name} (${registration.trainee.email})</td>
            <td>${getWorkoutNameById(registration.eventId)}</td>
            <td>${formatDate(registration.startTime)}</td>
            <td>${registration.endTime ? formatDate(registration.endTime) : '-'}</td>
            <td>
                <span class="status-badge status-${registration.status}">
                    ${getStatusText(registration.status)}
                </span>
            </td>
            <td>${formatDate(registration.createdAt)}</td>
            <td>
                <button onclick="editRegistration('${registration.id}')" class="btn btn-secondary">Edit</button>
                <button onclick="deleteRegistration('${registration.id}')" class="btn btn-danger">Delete</button>
            </td>
        </tr>
    `).join('');
}

function getStatusText(status) {
    const statusMap = {
        'scheduled': 'Scheduled',
        'canceled': 'Canceled',
        'completed': 'Completed'
    };
    return statusMap[status] || status;
}

// Modal management
function openCreateModal() {
    editingRegistrationId = null;
    document.getElementById('modal-title').textContent = 'Add New Registration';
    document.getElementById('registration-form').reset();
    document.getElementById('registration-id').value = '';

    // Set default start time to current time
    const now = new Date();
    document.getElementById('registration-start').value = formatDateTimeLocal(now);

    // Clear workout details
    document.getElementById('workout-details').style.display = 'none';

    // Clear validation messages
    clearValidationMessages();

    document.getElementById('registration-modal').style.display = 'block';
}

async function editRegistration(id) {
    try {
        editingRegistrationId = id;
        const registration = await api.getRegistration(id);

        document.getElementById('modal-title').textContent = 'Edit Registration';
        document.getElementById('registration-id').value = registration.id;
        document.getElementById('registration-trainee').value = registration.userId;
        document.getElementById('registration-workout').value = registration.eventId;
        document.getElementById('registration-email').value = registration.inviteeEmail;
        document.getElementById('registration-start').value = formatDateTimeLocal(registration.startTime);

        if (registration.endTime) {
            document.getElementById('registration-end').value = formatDateTimeLocal(registration.endTime);
        } else {
            document.getElementById('registration-end').value = '';
        }

        document.getElementById('registration-status').value = registration.status;

        // Display workout details
        displayWorkoutDetails(registration.eventId);

        // Clear validation messages
        clearValidationMessages();

        document.getElementById('registration-modal').style.display = 'block';
    } catch (error) {
        console.error('Error fetching registration:', error);
        showError('Error fetching registration: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('registration-modal').style.display = 'none';
    document.getElementById('modal-error').style.display = 'none';
    document.getElementById('workout-details').style.display = 'none';
    clearValidationMessages();
}

function clearValidationMessages() {
    document.querySelectorAll('.validation-message').forEach(el => {
        el.style.display = 'none';
    });
}

// Delete registration
async function deleteRegistration(id) {
    if (!confirm('Are you sure you want to delete this registration?')) {
        return;
    }

    try {
        await api.deleteRegistration(id);
        showSuccess('Registration deleted successfully');
        loadRegistrations();
    } catch (error) {
        console.error('Error deleting registration:', error);
        showError('Error deleting registration: ' + error.message);
    }
}

// Setup form validation and event listeners
function setupFormValidation() {
    // Trainee selection validation
    document.getElementById('registration-trainee').addEventListener('change', function() {
        const validationElement = document.getElementById('trainee-validation');
        if (this.value) {
            validationElement.textContent = 'Trainee selected';
            validationElement.style.color = 'green';
            validationElement.style.display = 'block';
        } else {
            validationElement.style.display = 'none';
        }
    });

    // Workout selection validation and details display
    document.getElementById('registration-workout').addEventListener('change', function() {
        const validationElement = document.getElementById('workout-validation');

        if (this.value) {
            validationElement.textContent = 'Workout selected';
            validationElement.style.color = 'green';
            validationElement.style.display = 'block';
            displayWorkoutDetails(this.value);
        } else {
            validationElement.style.display = 'none';
            displayWorkoutDetails(null);
        }
    });

    // Email validation
    document.getElementById('registration-email').addEventListener('input', function() {
        const email = this.value;
        const validationElement = document.getElementById('email-validation');

        if (email === '') {
            validationElement.style.display = 'none';
            return;
        }

        if (email.trim() === '') {
            validationElement.textContent = 'E-post ei või sisaldada ainult tühikuid';
            validationElement.style.color = 'red';
            validationElement.style.display = 'block';
        } else if (email !== email.trim()) {
            validationElement.textContent = 'E-post ei või alata ega lõppeda tühikutega';
            validationElement.style.color = 'red';
            validationElement.style.display = 'block';
        } else if (Auth.validateEmail(email.trim())) {
            validationElement.textContent = 'E-posti aadress on kehtiv';
            validationElement.style.color = 'green';
            validationElement.style.display = 'block';
        } else {
            validationElement.textContent = 'Vigane e-posti aadress';
            validationElement.style.color = 'red';
            validationElement.style.display = 'block';
        }
    });

    // Start time change handler for auto-calculating end time
    document.getElementById('registration-start').addEventListener('change', function() {
        calculateEndTime();
    });

    // Time validation
    document.getElementById('registration-start').addEventListener('change', function() {
        const startTime = this.value;
        const endTime = document.getElementById('registration-end').value;
        const validationElement = document.getElementById('start-time-validation');

        if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
            validationElement.textContent = 'Algusaeg peab olema enne lõpuaega';
            validationElement.style.color = 'red';
            validationElement.style.display = 'block';
        } else {
            validationElement.style.display = 'none';
        }
    });

    document.getElementById('registration-end').addEventListener('change', function() {
        const startTime = document.getElementById('registration-start').value;
        const endTime = this.value;
        const validationElement = document.getElementById('end-time-validation');

        if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
            validationElement.textContent = 'Lõpuaeg peab olema pärast algusaega';
            validationElement.style.color = 'red';
            validationElement.style.display = 'block';
        } else {
            validationElement.style.display = 'none';
        }
    });
}

// Utility functions
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.style.display = 'block';

    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

// Modal event listeners
document.querySelector('.close').addEventListener('click', closeModal);

window.addEventListener('click', (e) => {
    const modal = document.getElementById('registration-modal');
    if (e.target === modal) {
        closeModal();
    }
});

// Form submission
document.getElementById('registration-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const registrationData = Object.fromEntries(formData);
    const modalError = document.getElementById('modal-error');

    try {
        // Validate and trim fields
        const { trimmedFields, errors } = Auth.trimAndValidateFields(
            registrationData,
            ['userId', 'eventId', 'inviteeEmail', 'startTime']
        );

        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }

        // Validate email format
        if (!Auth.validateEmail(trimmedFields.inviteeEmail)) {
            throw new Error('Vigane kutse e-posti aadress');
        }

        // Check for whitespace issues in original values
        if (registrationData.inviteeEmail !== registrationData.inviteeEmail.trim()) {
            throw new Error('E-post ei või alata ega lõppeda tühikutega');
        }

        // Validate time logic
        const startTime = new Date(trimmedFields.startTime);
        if (trimmedFields.endTime) {
            const endTime = new Date(trimmedFields.endTime);
            if (startTime >= endTime) {
                throw new Error('Algusaeg peab olema enne lõpuaega');
            }
        }

        // Convert datetime-local inputs to ISO strings
        trimmedFields.startTime = new Date(trimmedFields.startTime).toISOString();
        if (trimmedFields.endTime) {
            trimmedFields.endTime = new Date(trimmedFields.endTime).toISOString();
        }

        if (editingRegistrationId) {
            // Update existing registration
            await api.updateRegistration(editingRegistrationId, trimmedFields);
            showSuccess('Registreerimine uuendatud edukalt');
        } else {
            // Create new registration
            await api.createRegistration(trimmedFields);
            showSuccess('Registreerimine loodud edukalt');
        }

        closeModal();
        loadRegistrations();
    } catch (error) {
        console.error('Error saving registration:', error);
        modalError.textContent = error.message;
        modalError.style.display = 'block';
    }
});

// Add status badge styles to CSS
const style = document.createElement('style');
style.textContent = `
    .status-badge {
        padding: 4px 8px;
        border-radius: 15px;
        color: white;
        font-size: 0.8em;
        font-weight: bold;
    }
    .status-scheduled {
        background-color: #007bff;
    }
    .status-canceled {
        background-color: #dc3545;
    }
    .status-completed {
        background-color: #28a745;
    }
`;
document.head.appendChild(style);

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupFormValidation();
});

// Load data on page load
Promise.all([
    loadRegistrations(),
    loadTrainees(),
    loadWorkouts()
]).catch(error => {
    console.error('Error loading initial data:', error);
    showError('Viga andmete laadimisel: ' + error.message);
});