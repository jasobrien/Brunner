/**
 * Simple in-memory settings storage
 */

const settings = {
  frequency: '1hr' // Default to 1 hour
};

/**
 * Get frequency setting
 * @returns {string} Current frequency setting
 */
function getFrequency() {
  return settings.frequency;
}

/**
 * Set frequency setting
 * @param {string} frequency - The frequency to set
 */
function setFrequency(frequency) {
  settings.frequency = frequency;
  console.log(`Frequency set to ${frequency}`);
}

module.exports = {
  getFrequency,
  setFrequency
};
