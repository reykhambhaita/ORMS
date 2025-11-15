// backend/auth.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Mechanic, User } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if(!JWT_SECRET){
  console.error("JWT_SECRET is not defined in environment variables");
  process.exit(1);
}
const JWT_EXPIRES_IN = '7d';

export const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// FIXED: Proper mechanic profile creation without duplicate storage
export const signup = async (req, res) => {
  try {
    const { email, username, password, role, mechanicData } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({
        error: 'Email, username, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    const userRole = role && ['user', 'mechanic'].includes(role) ? role : 'user';

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Email or username already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (NOT mechanic in same collection)
    const user = new User({
      email,
      username,
      password: hashedPassword,
      role: userRole,
      createdAt: new Date()
    });

    await user.save();

    console.log(`✅ User created: ${user._id} (${userRole})`);

    // CRITICAL: Create mechanic profile in SEPARATE collection ONLY if mechanic role
    let mechanicProfile = null;
    if (userRole === 'mechanic') {
      // Validate mechanic data
      if (!mechanicData?.phone) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({
          error: 'Phone number is required for mechanics'
        });
      }

      if (!mechanicData?.latitude || !mechanicData?.longitude) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({
          error: 'Location is required for mechanics'
        });
      }

      // Create mechanic profile in MECHANICS collection (separate from User)
      mechanicProfile = new Mechanic({
        userId: user._id,  // Reference to User, not duplicating user data
        name: mechanicData.name || username,
        phone: mechanicData.phone,
        location: {
          type: 'Point',
          coordinates: [
            parseFloat(mechanicData.longitude),
            parseFloat(mechanicData.latitude)
          ]
        },
        specialties: Array.isArray(mechanicData.specialties) ? mechanicData.specialties : [],
        available: mechanicData.available !== false,
        rating: 0,
        createdAt: new Date()
      });

      await mechanicProfile.save();
      console.log(`✅ Mechanic profile created: ${mechanicProfile._id} for user ${user._id}`);
    }

    const token = generateToken(user._id.toString(), user.role);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      },
      mechanicProfile: mechanicProfile ? {
        id: mechanicProfile._id,
        name: mechanicProfile.name,
        phone: mechanicProfile.phone,
        location: {
          latitude: mechanicProfile.location.coordinates[1],
          longitude: mechanicProfile.location.coordinates[0]
        },
        specialties: mechanicProfile.specialties,
        rating: mechanicProfile.rating,
        available: mechanicProfile.available
      } : null
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
};

// Login handler - FIXED to properly fetch mechanic profile
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user in USERS collection only
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Fetch mechanic profile from MECHANICS collection (separate)
    let mechanicProfile = null;
    if (user.role === 'mechanic') {
      mechanicProfile = await Mechanic.findOne({ userId: user._id });

      if (mechanicProfile) {
        console.log(`✅ Mechanic profile loaded: ${mechanicProfile._id}`);
      } else {
        console.warn(`⚠️ Mechanic profile not found for user ${user._id}`);
      }
    }

    const token = generateToken(user._id.toString(), user.role);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      },
      mechanicProfile: mechanicProfile ? {
        id: mechanicProfile._id,
        name: mechanicProfile.name,
        phone: mechanicProfile.phone,
        location: {
          latitude: mechanicProfile.location.coordinates[1],
          longitude: mechanicProfile.location.coordinates[0]
        },
        specialties: mechanicProfile.specialties,
        rating: mechanicProfile.rating,
        available: mechanicProfile.available
      } : null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch mechanic profile from MECHANICS collection
    let mechanicProfile = null;
    if (user.role === 'mechanic') {
      mechanicProfile = await Mechanic.findOne({ userId: user._id });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      },
      mechanicProfile: mechanicProfile ? {
        id: mechanicProfile._id,
        name: mechanicProfile.name,
        phone: mechanicProfile.phone,
        location: {
          latitude: mechanicProfile.location.coordinates[1],
          longitude: mechanicProfile.location.coordinates[0]
        },
        specialties: mechanicProfile.specialties,
        rating: mechanicProfile.rating,
        available: mechanicProfile.available
      } : null
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};
