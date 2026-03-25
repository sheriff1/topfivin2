import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app header", () => {
  render(<App />);
  const heading = screen.getByRole("link", { name: /NBA Top Five In/i });
  expect(heading).toBeInTheDocument();
});
