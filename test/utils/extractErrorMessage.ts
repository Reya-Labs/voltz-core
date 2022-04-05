export const extractErrorMessage = (error: any): string | null => {
  if (!error) {
    return null;
  }

  if (!error.message && !error.data.message) {
    return null;
  }

  if (error.data && error.data.message) {
    return error.data.message.toString();
  }

  if (error.message) {
    return error.message.toString();
  }

  return null;
};
