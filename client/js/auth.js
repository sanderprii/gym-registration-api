// Authentication helper functions with validation
class Auth {
    static saveAuthData(token, user) {
        localStorage.setItem(CONFIG.TOKEN_KEY, token);
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    }

    static getToken() {
        return localStorage.getItem(CONFIG.TOKEN_KEY);
    }

    static getUser() {
        const user = localStorage.getItem(CONFIG.USER_KEY);
        return user ? JSON.parse(user) : null;
    }

    static clearAuthData() {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
    }

    static isLoggedIn() {
        return this.getToken() !== null;
    }

    static redirectIfNotLoggedIn() {
        if (!this.isLoggedIn()) {
            window.location.href = 'index.html';
        }
    }

    static redirectIfLoggedIn() {
        if (this.isLoggedIn()) {
            window.location.href = 'dashboard.html';
        }
    }

    // Validation functions
    static validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { isValid: false, message: 'Parool on nõutav' };
        }

        const trimmedPassword = password.trim();

        if (trimmedPassword.length === 0) {
            return { isValid: false, message: 'Parool ei või olla tühi või sisaldada ainult tühikuid' };
        }

        if (trimmedPassword.length < 8) {
            return { isValid: false, message: 'Parool peab olema vähemalt 8 tähemärki pikk' };
        }

        if (trimmedPassword !== password) {
            return { isValid: false, message: 'Parool ei või alata ega lõppeda tühikutega' };
        }

        // Check if password contains at least one non-space character
        if (!/\S/.test(password)) {
            return { isValid: false, message: 'Parool ei või sisaldada ainult tühikuid' };
        }

        return { isValid: true, message: 'Parool on kehtiv' };
    }

    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static trimAndValidateFields(fields, requiredFields = []) {
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
                errors.push(`${field} on nõutav ja ei või olla tühi`);
            }
        });

        return { trimmedFields, errors };
    }

    static async login(email, password) {
        try {
            // Validate and trim fields
            const { trimmedFields, errors } = this.trimAndValidateFields(
                { email, password },
                ['email', 'password']
            );

            if (errors.length > 0) {
                throw new Error(errors.join(', '));
            }

            // Validate email format
            if (!this.validateEmail(trimmedFields.email)) {
                throw new Error('Vigane e-posti aadress');
            }

            const response = await api.login(trimmedFields.email, trimmedFields.password);
            if (response.token) {
                this.saveAuthData(response.token, response.trainee);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    static async logout() {
        try {
            await api.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearAuthData();
            window.location.href = 'index.html';
        }
    }

    static displayUserInfo() {
        const user = this.getUser();
        if (user) {
            const userInfoElement = document.getElementById('user-info');
            if (userInfoElement) {
                userInfoElement.textContent = `Tere tulemast, ${user.name} (${user.email})`;
            }
        }
    }

    // Helper function for real-time password validation display
    static displayPasswordValidation(password, validationElement) {
        const validation = this.validatePassword(password);

        if (validationElement) {
            if (password === '') {
                validationElement.textContent = '';
                validationElement.style.display = 'none';
                return;
            }

            validationElement.textContent = validation.message;
            if (validation.isValid) {
                validationElement.style.color = 'green';
                validationElement.style.display = 'block';
            } else {
                validationElement.style.color = 'red';
                validationElement.style.display = 'block';
            }
        }

        return validation;
    }
}