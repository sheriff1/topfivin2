import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app header", () => {
  render(<App />);
  const heading = screen.getByText(/NBA Stats Rankings/i);
  expect(heading).toBeInTheDocument();
});
