// index.js

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');


// Initialize Express app
const app = express();

// Body-parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Connect to MongoDB (replace 'your_db_uri' with your actual MongoDB URI)
mongoose.connect('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// Create a mongoose schema
const UserSchema = new mongoose.Schema({
    name: String,
    email:{type:String,unique:true},
    password: String,
    passwordResetToken: String,
    passwordResetExpires: Date
});

// Create a mongoose model
const User = mongoose.model('User', UserSchema);

// Route to serve signup form
app.get('/signup', (req, res) => {
    res.sendFile(__dirname + '/public/'+'signup.html');
});
app.get('/weather', (req, res) => {
    res.sendFile(__dirname + '/public/'+'weather.html');
});
app.get('/resetpwd', (req, res) => {
    // Here you can render the reset password HTML page
    res.sendFile(__dirname + '/public/' + 'resetpwd.html');
});
app.get('/forgot-password',(req,res)=>{
    res.sendFile(__dirname + '/public/' + 'forgotpwd.html');
});
// Route to handle form submission
app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if the email is already registered
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash the password before saving it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user instance with the hashed password
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        // Save the new user to the database
        await newUser.save();

        // Return success response
        res.sendFile(__dirname +'/public/'+'login.html');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Route to serve login form
app.get('/login', (req, res) => {
    res.sendFile(__dirname +'/public/'+'login.html');
});

// Route to handle login form submission
// Route to handle login form submission
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Compare the hashed password with the entered password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Incorrect password' });
        }

        // Password is correct, proceed with login
        // Implement your login logic here
        res.json({ success: true, message: 'Login successful' });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to check if email already exists
app.post('/checkEmail', (req, res) => {
    User.findOne({ email: req.body.email })
        .then(existingUser => {
            if (existingUser) {
                // Email already exists
                res.json({ exists: true });
            } else {
                // Email doesn't exist
                res.json({ exists: false });
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        });
});
app.post('/forgotPassword', async (req, res) => {
    const { email } = req.body;
    
    try {
        // Check if the user with the provided email exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Generate a unique token (e.g., using crypto or UUID)
        const token = crypto.randomBytes(20).toString('hex');
        
        // Store the token and expiration time in the database
        user.passwordResetToken = token;
        user.passwordResetExpires = Date.now() + 3600000; // Token expires in 1 hour
        await user.save();
        
        // Send password reset email with token link
        sendPasswordResetEmail(email, token);
        
        res.json({ success: true, message: 'Password reset email sent' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Function to send password reset email
function sendPasswordResetEmail(email, token) {
    // Configure nodemailer transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail',
    auth: {
        user: 'sender_email', // Your Gmail email address
        pass: 'sender_pwd' // Your Gmail password or app password
    }
    });
    
    // Email content
    const mailOptions = {
        from: 'sender_email',
        to: email,
        subject: 'Password Reset',
        text: `Click the link to reset your password: http://localhost:3000/resetpwd?token=${token}`,
    };
    
    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Email error:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}
// Route to handle password reset
app.post('/resetpassword', async (req, res) => {
    const {password, token } = req.body;
    console.log('Received data:', req.body);

    try {
        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid token or token has expired' });
        }

        // Hash the new password and update the user's password
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Password has been reset' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

const PORT =3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
