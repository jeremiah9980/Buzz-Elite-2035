// Buzz Elite Fastpitch — Team Configuration
// Update this file to change team-wide settings across the entire site.

const teamConfig = {
  teamName: "Buzz",
  displayName: "Buzz Fastpitch",
  fullName: "Buzz Elite Fastpitch",
  season: "2035",
  location: "Texas",
  sport: "Select Fastpitch Softball",
  slogan: "Sting Fast. Win Together.",
  subSlogan: "Built Elite • Play Hard • Finish Strong",
  bodyClass: "buzz-page",

  colors: {
    primary: "#F59E0B",    // Buzz gold
    primaryDark: "#D97706",
    primaryLight: "#FEF3C7",
    black: "#060608",
    inkDark: "#0D0D11",
    inkMid: "#1A1A22",
    white: "#FFFFFF",
    smoke: "#F5F4F0",
    silver: "#D4C89A",
    gray: "#8A8070"
  },

  logo: "assets/img/buzz-fastpitch-logo.svg",
  logoAlt: "Buzz Fastpitch logo",

  social: {
    instagram: {
      handle: "[ENTER INSTAGRAM HANDLE]",
      url: "[ENTER INSTAGRAM URL]"
    },
    facebook: {
      name: "Buzz Fastpitch",
      url: "[ENTER FACEBOOK URL]"
    }
  },

  ncs: {
    teamId: "[ENTER NCS TEAM ID]",
    teamUrl: "[ENTER NCS TEAM URL]",
    teamName: "Buzz Elite Fastpitch",
    division: "10U"
  },

  gamechanger: {
    teamId: "[ENTER GAMECHANGER TEAM ID]",
    teamUrl: "[ENTER GAMECHANGER URL]",
    teamName: "Buzz Elite Fastpitch"
  },

  contact: {
    email: "[ENTER CONTACT EMAIL]",
    phone: "[ENTER CONTACT PHONE]",
    location: "Texas"
  }
};

if (typeof module !== 'undefined') module.exports = teamConfig;
