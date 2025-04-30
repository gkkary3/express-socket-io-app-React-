const generateMessage = (username, text, type = "message") => {
  return {
    username,
    text,
    type,
    createdAt: new Date().getTime(),
  };
};

module.exports = { generateMessage };
