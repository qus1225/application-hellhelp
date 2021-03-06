var express = require('express');
var router = express.Router();
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var credentials = require('./credentials');
var hero = require('./db/hero');
var db = require('./model/index');

passport.serializeUser(function(user, done) {
  console.log('serialize');
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  console.log('deserialize');
  done(null, user);
});

passport.use(new FacebookStrategy({
    clientID: credentials.FACEBOOK_APP_ID,
    clientSecret: credentials.FACEBOOK_APP_SECRET,
    callbackURL: '/auth/facebook/callback',
    passReqToCallback: true,
    profileFields: ['id', 'email', 'name']
  },
  function(req, accessToken, refreshToken, profile, done) {
    hero.findOne({ where: {provider_user_id: profile.id, provider: profile.provider} }).then(hero => {
      // project will be the first entry of the Projects table with the title 'aProject' || null
      if (hero) {
        return done(null, hero);
      }
      db.heroModel.insertHero({provider_user_id: profile.id, provider: profile.provider, email: profile.emails[0].value, nickName: profile.name.givenName}, function (results) {
        return done(null, results[0]);
      });
    });
  }
));

router
  .get('/', function (req, res) {
    if (req.session.passport != undefined) {
      res.render('home', { heroInfo: req.session.passport.user });
    } else {
      res.render('home');
    }
  })
  .get('/register-hero', function(req, res) {
    res.render('register-hero', { heroInfo: req.session.passport.user });
  })
  .post('/register-hero', function(req, res) {
    db.heroModel.updateHero(req.body, { provider_user_id: req.body.provider_user_id }, function () {
      req.logout();
      res.redirect('/auth/facebook');
    });
  })
  .get('/map', ensureAuthenticated, function(req, res) {
    db.monsterModel.selectMonster(null, function (results) {
      res.render('map', {
        heroInfo: req.session.passport.user,
        monsters: results
      });
    });
  })
  .post('/register-monster', function(req, res) {
    req.body.desc = req.body.desc.replace(/(?:\r\n|\r|\n)/g, '<br />');
    db.monsterModel.insertMonster(req.body, function () {
      res.redirect('/map');
    });
  })
  .post('/battle', function(req, res) {
    db.battleModel.insertBattle(req.body, function () {
      res.redirect('/map');
    });
  })
;

router
  .get('/auth/facebook', passport.authenticate('facebook', {
    authType: 'rerequest', scope: ['public_profile', 'email']
  }))
  .get('/auth/facebook/callback', passport.authenticate('facebook', { successRedirect: '/login_success',
    failureRedirect: '/login_fail' }))
  .get('/login_success', ensureAuthenticated, function(req, res){
    if (req.session.passport.user.skill == null) {
      res.redirect('/register-hero');
    } else {
      res.redirect('/map');
    }
  })
  .get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
  });

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/');
}

module.exports = router;