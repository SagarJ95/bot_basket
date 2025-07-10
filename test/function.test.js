// fetchData.js
const axios = require('axios');

// // Function to fetch data from an external API
const fetchData = async (url) => {
  const response = await axios.get(url);
  return response.data;
};

// Export the function using CommonJS export
module.exports = { fetchData };

// fetchData.test.js
const { fetchData } = require('./fetchData');

// Mocking axios module
jest.mock('axios');

describe('fetchData', () => {
  it('fetches data successfully', async () => {
    // Mocking axios.get method
    axios.get.mockResolvedValue({ data: { userId: 1, id: 1, title: 'Test' } });

    const data = await fetchData('https://jsonplaceholder.typicode.com/posts/1');

    expect(data).toEqual({ userId: 1, id: 1, title: 'Test' });
    expect(axios.get).toHaveBeenCalledWith('https://jsonplaceholder.typicode.com/posts/1');
  });
});
