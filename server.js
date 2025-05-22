/***************************************************************************
 * server.js
 ***************************************************************************/

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const yaml = require('yamljs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Load the OpenAPI specification
const openapiDocumentEn = yaml.load(path.join(__dirname, 'openapi.yaml'));
const openapiDocumentEt = yaml.load(path.join(__dirname, 'openapi-et.yaml'));
const app = express();
const port = process.env.PORT || 3000;

// For demo purposes only; in production, store secrets in env variables
const JWT_SECRET = process.env.JWT_SECRET;

// Track revoked tokens for logout (in production use Redis or database)
const revokedTokens = new Set();

// ---------------------------------------------------------------------------
// Validation and utility functions
// ---------------------------------------------------------------------------

// Password validation function
function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { isValid: false, message: 'Password is required' };
    }

    const trimmedPassword = password.trim();

    if (trimmedPassword.length === 0) {
        return { isValid: false, message: 'Password cannot be empty or contain only spaces' };
    }

    if (trimmedPassword.length < 8) {
        return { isValid: false, message: 'Password must be at least 8 characters long' };
    }

    if (trimmedPassword !== password) {
        return { isValid: false, message: 'Password cannot start or end with spaces' };
    }

    // Check if password contains at least one non-space character
    if (!/\S/.test(password)) {
        return { isValid: false, message: 'Password cannot contain only spaces' };
    }

    return { isValid: true, message: 'Password is valid' };
}

// Field trimming and validation function
function trimAndValidateFields(fields, requiredFields = []) {
    const trimmedFields = {};
    const errors = [];

    // Trim all string fields
    Object.keys(fields).forEach(key => {
        if (typeof fields[key] === 'string') {
            trimmedFields[key] = fields[key].trim();
        } else {
            trimmedFields[key] = fields[key];
        }
    });

    // Check required fields after trimming
    requiredFields.forEach(field => {
        if (!trimmedFields[field] || trimmedFields[field] === '') {
            errors.push(`${field} is required and cannot be empty`);
        }
    });

    return { trimmedFields, errors };
}

// Email validation function
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Middleware
app.use(cors());
app.use(express.json());

// Create separate Swagger UI setup functions
function setupSwaggerEn(req, res, next) {
    return swaggerUi.setup(openapiDocumentEn)(req, res, next);
}

function setupSwaggerEt(req, res, next) {
    return swaggerUi.setup(openapiDocumentEt)(req, res, next);
}

// Use separate setup functions
app.use('/api-docs-en', swaggerUi.serve, setupSwaggerEn);
app.use('/api-docs-et', swaggerUi.serve, setupSwaggerEt);

app.get('/', (req, res) => {
    res.send('Tere tulemast Gym Training Registration API-sse!');
});

// ---------------------------------------------------------------------------
// JWT Authentication Middleware
// ---------------------------------------------------------------------------
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authorization token missing' });
    }

    // Check if token is revoked
    if (revokedTokens.has(token)) {
        return res.status(401).json({ error: 'Token is revoked' });
    }

    // Verify token
    jwt.verify(token, JWT_SECRET, (err, userData) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = userData;
        req.token = token; // store token if needed (e.g., for logout)
        next();
    });
}

// ---------------------------------------------------------------------------
// /sessions endpoints: login, logout, check session
// ---------------------------------------------------------------------------

// Create session (Login)
app.post('/sessions', async (req, res) => {
    try {
        const { trimmedFields, errors } = trimAndValidateFields(req.body, ['email', 'password']);

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(', ') });
        }

        const { email, password } = trimmedFields;

        // Validate email format
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const trainee = await prisma.trainee.findUnique({
            where: { email }
        });

        if (!trainee) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // In a real application, you should hash passwords. For now, comparing plaintext.
        // To use hashed passwords: const isValidPassword = await bcrypt.compare(password, trainee.password);
        if (trainee.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create JWT
        const token = jwt.sign(
            { traineeId: trainee.id, email: trainee.email },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        // Remove password from response
        const { password: _, ...traineeWithoutPassword } = trainee;

        res.status(200).json({
            token,
            trainee: traineeWithoutPassword
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Destroy session (Logout)
app.delete('/sessions', authenticateToken, (req, res) => {
    // Revoke current token
    revokedTokens.add(req.token);
    return res.status(200).json({ message: 'Successfully logged out' });
});

// Check session (Authenticated?)
app.get('/sessions', authenticateToken, async (req, res) => {
    try {
        const trainee = await prisma.trainee.findUnique({
            where: { id: req.user.traineeId }
        });

        if (!trainee) {
            return res.status(404).json({ error: 'Trainee not found' });
        }

        // Remove password from response
        const { password: _, ...traineeWithoutPassword } = trainee;

        return res.status(200).json({
            authenticated: true,
            trainee: traineeWithoutPassword
        });
    } catch (error) {
        console.error('Check session error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------------------------
// /trainees endpoints
// ---------------------------------------------------------------------------

// List all trainees with pagination
app.get('/trainees', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const skip = (page - 1) * pageSize;

        const [trainees, total] = await prisma.$transaction([
            prisma.trainee.findMany({
                skip,
                take: pageSize,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    timezone: true,
                    createdAt: true,
                    updatedAt: true
                }
            }),
            prisma.trainee.count()
        ]);

        res.status(200).json({
            data: trainees,
            pagination: {
                page,
                pageSize,
                total
            }
        });
    } catch (error) {
        console.error('List trainees error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new trainee
app.post('/trainees', async (req, res) => {
    try {
        const { trimmedFields, errors } = trimAndValidateFields(req.body, ['name', 'email', 'password']);

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(', ') });
        }

        const { name, email, password, timezone } = trimmedFields;

        // Validate email format
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // Check if email already exists
        const existingTrainee = await prisma.trainee.findUnique({
            where: { email }
        });

        if (existingTrainee) {
            return res.status(400).json({ error: 'Email is already in use' });
        }

        // In a real application, hash the password: const hashedPassword = await bcrypt.hash(password, 10);
        const newTrainee = await prisma.trainee.create({
            data: {
                name,
                email,
                password, // Use hashedPassword in production
                timezone: timezone || null
            },
            select: {
                id: true,
                name: true,
                email: true,
                timezone: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.status(201).json(newTrainee);
    } catch (error) {
        console.error('Create trainee error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get trainee details
app.get('/trainees/:traineeId', authenticateToken, async (req, res) => {
    try {
        const { traineeId } = req.params;

        const trainee = await prisma.trainee.findUnique({
            where: { id: traineeId },
            select: {
                id: true,
                name: true,
                email: true,
                timezone: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!trainee) {
            return res.status(404).json({ error: 'Trainee not found' });
        }

        res.status(200).json(trainee);
    } catch (error) {
        console.error('Get trainee error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Partially update a trainee
app.patch('/trainees/:traineeId', authenticateToken, async (req, res) => {
    try {
        const { traineeId } = req.params;
        const { trimmedFields } = trimAndValidateFields(req.body);
        const { name, email, password, timezone } = trimmedFields;

        // Build update object dynamically with validation
        const updateData = {};
        const errors = [];

        if (name !== undefined) {
            if (name === '') {
                errors.push('Name cannot be empty');
            } else {
                updateData.name = name;
            }
        }

        if (email !== undefined) {
            if (email === '') {
                errors.push('Email cannot be empty');
            } else if (!validateEmail(email)) {
                errors.push('Invalid email format');
            } else {
                updateData.email = email;
            }
        }

        if (password !== undefined) {
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.isValid) {
                errors.push(passwordValidation.message);
            } else {
                updateData.password = password; // Hash in production
            }
        }

        if (timezone !== undefined) {
            updateData.timezone = timezone || null;
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(', ') });
        }

        const updatedTrainee = await prisma.trainee.update({
            where: { id: traineeId },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                timezone: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.status(200).json(updatedTrainee);
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Trainee not found' });
        }
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Email is already in use' });
        }
        console.error('Update trainee error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a trainee
app.delete('/trainees/:traineeId', authenticateToken, async (req, res) => {
    try {
        const { traineeId } = req.params;

        await prisma.trainee.delete({
            where: { id: traineeId }
        });

        res.status(204).send();
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Resource not found' });
        }
        console.error('Delete trainee error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------------------------
// /workouts endpoints
// ---------------------------------------------------------------------------

// List all workouts
app.get('/workouts', authenticateToken, async (req, res) => {
    try {
        const workouts = await prisma.workout.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(workouts);
    } catch (error) {
        console.error('List workouts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new workout type
app.post('/workouts', authenticateToken, async (req, res) => {
    try {
        const { trimmedFields, errors } = trimAndValidateFields(req.body, ['name']);

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(', ') });
        }

        const { name, duration, description, color } = trimmedFields;

        if (!duration || duration <= 0) {
            return res.status(400).json({ error: 'Duration must be a positive number' });
        }

        const newWorkout = await prisma.workout.create({
            data: {
                name,
                duration: parseInt(duration),
                description: description || null,
                color: color || null
            }
        });

        res.status(201).json(newWorkout);
    } catch (error) {
        console.error('Create workout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get workout details
app.get('/workouts/:workoutId', authenticateToken, async (req, res) => {
    try {
        const { workoutId } = req.params;

        const workout = await prisma.workout.findUnique({
            where: { id: workoutId }
        });

        if (!workout) {
            return res.status(404).json({ error: 'Workout not found' });
        }

        res.status(200).json(workout);
    } catch (error) {
        console.error('Get workout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Partially update a workout
app.patch('/workouts/:workoutId', authenticateToken, async (req, res) => {
    try {
        const { workoutId } = req.params;
        const { trimmedFields } = trimAndValidateFields(req.body);
        const { name, duration, description, color } = trimmedFields;

        // Build update object dynamically with validation
        const updateData = {};
        const errors = [];

        if (name !== undefined) {
            if (name === '') {
                errors.push('Name cannot be empty');
            } else {
                updateData.name = name;
            }
        }

        if (duration !== undefined) {
            const durationNum = parseInt(duration);
            if (isNaN(durationNum) || durationNum <= 0) {
                errors.push('Duration must be a positive number');
            } else {
                updateData.duration = durationNum;
            }
        }

        if (description !== undefined) {
            updateData.description = description || null;
        }

        if (color !== undefined) {
            updateData.color = color || null;
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(', ') });
        }

        const updatedWorkout = await prisma.workout.update({
            where: { id: workoutId },
            data: updateData
        });

        res.status(200).json(updatedWorkout);
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Workout not found' });
        }
        console.error('Update workout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a workout
app.delete('/workouts/:workoutId', authenticateToken, async (req, res) => {
    try {
        const { workoutId } = req.params;

        await prisma.workout.delete({
            where: { id: workoutId }
        });

        res.status(204).send();
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Resource not found' });
        }
        console.error('Delete workout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------------------------
// /routines endpoints
// ---------------------------------------------------------------------------

// List all routines
app.get('/routines', authenticateToken, async (req, res) => {
    try {
        const { traineeId } = req.query;

        const whereClause = traineeId ? { userId: traineeId } : {};

        const routines = await prisma.routine.findMany({
            where: whereClause,
            include: {
                trainee: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (traineeId && routines.length === 0) {
            return res.status(404).json({ error: 'No routines found for the given trainee ID' });
        }

        // Parse availability strings to JSON objects for response
        const parsedRoutines = routines.map(routine => ({
            ...routine,
            availability: JSON.parse(routine.availability)
        }));

        res.status(200).json(parsedRoutines);
    } catch (error) {
        console.error('List routines error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new routine
app.post('/routines', authenticateToken, async (req, res) => {
    try {
        const { trimmedFields, errors } = trimAndValidateFields(req.body, ['userId']);

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(', ') });
        }

        const { userId, availability } = trimmedFields;

        if (!availability) {
            return res.status(400).json({ error: 'availability is required' });
        }

        // Check if trainee exists
        const trainee = await prisma.trainee.findUnique({
            where: { id: userId }
        });

        if (!trainee) {
            return res.status(400).json({ error: 'Trainee not found' });
        }

        const newRoutine = await prisma.routine.create({
            data: {
                userId,
                availability: JSON.stringify(availability)
            },
            include: {
                trainee: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        // Parse the availability back to object for response
        newRoutine.availability = JSON.parse(newRoutine.availability);

        res.status(201).json(newRoutine);
    } catch (error) {
        console.error('Create routine error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific trainee's routine
app.get('/routines/trainee/:traineeId', authenticateToken, async (req, res) => {
    try {
        const { traineeId } = req.params;

        const routine = await prisma.routine.findFirst({
            where: { userId: traineeId },
            include: {
                trainee: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!routine) {
            return res.status(404).json({ error: 'Routine not found' });
        }

        // Parse the availability JSON
        routine.availability = JSON.parse(routine.availability);

        res.status(200).json(routine);
    } catch (error) {
        console.error('Get routine error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Partially update a trainee's routine
app.patch('/routines/trainee/:traineeId', authenticateToken, async (req, res) => {
    try {
        const { traineeId } = req.params;
        const { availability } = req.body;

        if (!availability) {
            return res.status(400).json({ error: 'availability is required' });
        }

        const updatedRoutine = await prisma.routine.updateMany({
            where: { userId: traineeId },
            data: {
                availability: JSON.stringify(availability)
            }
        });

        if (updatedRoutine.count === 0) {
            return res.status(404).json({ error: 'Routine not found' });
        }

        // Get the updated routine to return
        const routine = await prisma.routine.findFirst({
            where: { userId: traineeId },
            include: {
                trainee: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        routine.availability = JSON.parse(routine.availability);

        res.status(200).json(routine);
    } catch (error) {
        console.error('Update routine error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a routine
app.delete('/routines/trainee/:traineeId', authenticateToken, async (req, res) => {
    try {
        const { traineeId } = req.params;

        const deletedRoutine = await prisma.routine.deleteMany({
            where: { userId: traineeId }
        });

        if (deletedRoutine.count === 0) {
            return res.status(404).json({ error: 'Resource not found' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Delete routine error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------------------------
// /registrations endpoints
// ---------------------------------------------------------------------------

// List all registrations
app.get('/registrations', authenticateToken, async (req, res) => {
    try {
        const registrations = await prisma.registration.findMany({
            include: {
                trainee: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(registrations);
    } catch (error) {
        console.error('List registrations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register for a workout
app.post('/registrations', authenticateToken, async (req, res) => {
    try {
        const { trimmedFields, errors } = trimAndValidateFields(req.body, ['eventId', 'userId', 'inviteeEmail', 'startTime']);

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(', ') });
        }

        const { eventId, userId, inviteeEmail, startTime, endTime, status } = trimmedFields;

        // Validate email format
        if (!validateEmail(inviteeEmail)) {
            return res.status(400).json({ error: 'Invalid invitee email format' });
        }

        // Check if trainee exists
        const trainee = await prisma.trainee.findUnique({
            where: { id: userId }
        });

        if (!trainee) {
            return res.status(400).json({ error: 'Trainee not found' });
        }

        const newRegistration = await prisma.registration.create({
            data: {
                eventId,
                userId,
                inviteeEmail,
                startTime: new Date(startTime),
                endTime: endTime ? new Date(endTime) : null,
                status: status || 'scheduled'
            },
            include: {
                trainee: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        res.status(201).json(newRegistration);
    } catch (error) {
        console.error('Create registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get registration details
app.get('/registrations/:registrationId', authenticateToken, async (req, res) => {
    try {
        const { registrationId } = req.params;

        const registration = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: {
                trainee: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        res.status(200).json(registration);
    } catch (error) {
        console.error('Get registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Partially update a registration
app.patch('/registrations/:registrationId', authenticateToken, async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { trimmedFields } = trimAndValidateFields(req.body);
        const { eventId, userId, inviteeEmail, startTime, endTime, status } = trimmedFields;

        // Build update object dynamically with validation
        const updateData = {};
        const errors = [];

        if (eventId !== undefined) {
            if (eventId === '') {
                errors.push('Event ID cannot be empty');
            } else {
                updateData.eventId = eventId;
            }
        }

        if (userId !== undefined) {
            if (userId === '') {
                errors.push('User ID cannot be empty');
            } else {
                updateData.userId = userId;
            }
        }

        if (inviteeEmail !== undefined) {
            if (inviteeEmail === '') {
                errors.push('Invitee email cannot be empty');
            } else if (!validateEmail(inviteeEmail)) {
                errors.push('Invalid invitee email format');
            } else {
                updateData.inviteeEmail = inviteeEmail;
            }
        }

        if (startTime !== undefined) updateData.startTime = new Date(startTime);
        if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;
        if (status !== undefined) updateData.status = status;

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(', ') });
        }

        const updatedRegistration = await prisma.registration.update({
            where: { id: registrationId },
            data: updateData,
            include: {
                trainee: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        res.status(200).json(updatedRegistration);
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Registration not found' });
        }
        console.error('Update registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a registration
app.delete('/registrations/:registrationId', authenticateToken, async (req, res) => {
    try {
        const { registrationId } = req.params;

        await prisma.registration.delete({
            where: { id: registrationId }
        });

        res.status(204).send();
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Resource not found' });
        }
        console.error('Delete registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

// ---------------------------------------------------------------------------
// Start the Server
// ---------------------------------------------------------------------------
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Swagger UI (EN) available at http://localhost:${port}/api-docs-en`);
    console.log(`Swagger UI (ET) available at http://localhost:${port}/api-docs-et`);
});