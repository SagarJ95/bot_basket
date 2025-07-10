const testProject = (a,b) => {
    if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error("Invalid");
  }
  return a + b;
}

test("testing 2 + 5 is eual to 7", () => {
    expect(testProject(2,5)).toBe(7)
});

test("should throw 'Invalid' error for invalid input", () => {
  expect(() => testProject(2, "4")).toThrow("Invalid");
});
