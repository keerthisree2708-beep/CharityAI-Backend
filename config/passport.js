const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || 'mock_client_id_for_dev_mode',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret',
        callbackURL: '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        const newUser = {
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          role: 'donor', // Google OAuth users default to donor
          isVerified: true,
        };

        try {
          let user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // Update googleId if they signed up with email before but now use Google
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
            }
            done(null, user);
          } else {
            user = await User.create(newUser);
            done(null, user);
          }
        } catch (err) {
          console.error(err);
          done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};
