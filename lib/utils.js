/**
 * Generates a random positive integer.
 *
 * @returns {Number}
 */
exports.generateRandomNumber = function () {
  return Math.round(Math.random() * 10000000);
};

export const sleep = async (ms) => {
  return new Promise((r) => setTimeout(() => r(), ms));
};
