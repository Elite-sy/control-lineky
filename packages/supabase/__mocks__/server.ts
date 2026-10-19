/**
 * Mock for @lineky/supabase/server
 * Used during Jest tests to avoid actual Supabase connections
 */

const mockGetUser = jest.fn().mockResolvedValue({
  data: { user: null },
  error: null,
});

const mockClient = {
  auth: {
    getUser: mockGetUser,
  },
};

const createClient = jest.fn().mockResolvedValue(mockClient);

module.exports = { createClient };
exports.createClient = createClient;
