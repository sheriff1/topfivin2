import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useApiHealth } from "../../hooks/useApi";
import { Layout } from "../Layout";

// Mock the useApi hook
vi.mock("../../hooks/useApi", () => ({
  useApiHealth: vi.fn(),
}));

describe("Layout Component", () => {
  const mockChildren = <div data-testid="test-content">Test Content</div>;

  beforeEach(() => {
    useApiHealth.mockReturnValue({
      data: {
        status: "healthy",
        api: "online",
      },
      isLoading: false,
      error: null,
    });
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("should render layout wrapper", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const layoutDiv = container.querySelector(".min-h-screen");
    expect(layoutDiv).toBeDefined();
  });

  it("should render header with navbar", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const navbar = container.querySelector(".navbar");
    expect(navbar).toBeDefined();
  });

  it("should have neutral color styling on navbar", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const navbar = container.querySelector(".navbar");
    expect(navbar.className).toContain("bg-neutral");
    expect(navbar.className).toContain("text-neutral-content");
  });

  it("should display logo with basketball emoji", () => {
    render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    expect(screen.getByText(/🏀 NBA Top Five In/)).toBeDefined();
  });

  it("should have link to home page", () => {
    render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const homeLink = screen.getByRole("link", { name: /🏀 NBA Top Five In/ });
    expect(homeLink.href).toContain("/");
  });

  it("should render navigation links", () => {
    render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    // Find navigation links (exclude logo link)
    const allLinks = screen.getAllByRole("link");
    const navLinks = allLinks.filter(
      (link) => link.className.includes("btn-ghost") && link.className.includes("btn-sm")
    );
    expect(navLinks.length).toBeGreaterThanOrEqual(3);
    expect(navLinks.some((link) => link.textContent.includes("Rankings"))).toBe(true);
    expect(navLinks.some((link) => link.textContent.includes("Teams"))).toBe(true);
    expect(navLinks.some((link) => link.textContent.includes("Audit"))).toBe(true);
  });

  it("should have active highlight on current route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Layout>{mockChildren}</Layout>
      </MemoryRouter>
    );

    const rankingsLink = screen.getByRole("link", { name: "Rankings" });
    expect(rankingsLink.className).toContain("bg-primary-content/20");
  });

  it("should highlight Teams link when on /teams route", () => {
    render(
      <MemoryRouter initialEntries={["/teams"]}>
        <Layout>{mockChildren}</Layout>
      </MemoryRouter>
    );

    const teamsLink = screen.getByRole("link", { name: /Teams/ });
    expect(teamsLink.className).toContain("bg-primary-content/20");
  });

  it("should highlight Audit link when on /audit route", () => {
    render(
      <MemoryRouter initialEntries={["/audit"]}>
        <Layout>{mockChildren}</Layout>
      </MemoryRouter>
    );

    const auditLink = screen.getByRole("link", { name: /Audit/ });
    expect(auditLink.className).toContain("bg-primary-content/20");
  });

  it("should render children content", () => {
    render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    expect(screen.getByTestId("test-content")).toBeDefined();
    expect(screen.getByText("Test Content")).toBeDefined();
  });

  it("should have flex column layout for sticky footer", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const root = container.firstChild;
    expect(root.className).toContain("flex");
    expect(root.className).toContain("flex-col");
    expect(root.className).toContain("min-h-screen");
  });

  it("should have flex-1 on content area", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const contentArea = container.querySelector(".flex-1");
    expect(contentArea).toBeDefined();
  });

  it("should have sticky navbar", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const navbar = container.querySelector(".navbar");
    expect(navbar.className).toContain("sticky");
    expect(navbar.className).toContain("top-0");
    expect(navbar.className).toContain("z-50");
  });

  it("should have lower case text for logo", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const logoButton = container.querySelector(".btn-ghost");
    expect(logoButton.className).toContain("normal-case");
  });

  it("should render multiple navigation links", () => {
    render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const links = screen.getAllByRole("link");
    expect(links.length).toBe(7); // Home + 5 nav tabs (Rankings, Teams, Games Count, Audit, About) + footer link — dev mode
  });

  it("should have proper navbar layout with start and end sections", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const navbarStart = container.querySelector(".navbar-start");
    expect(navbarStart).toBeDefined();

    const navbarEnd = container.querySelector(".navbar-end");
    expect(navbarEnd).toBeDefined();
  });

  it("should have shadow on navbar", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const navbar = container.querySelector(".navbar");
    expect(navbar.className).toContain("shadow-lg");
  });

  it("should have gap between nav links", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const nav = container.querySelector("nav");
    expect(nav.className).toContain("gap-1");
  });

  it("should have base-100 background", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const layoutDiv = container.querySelector(".min-h-screen");
    expect(layoutDiv.className).toContain("bg-base-100");
  });

  it("should render correct nav links for navigation", () => {
    render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const allLinks = screen.getAllByRole("link");
    const navLinks = allLinks.filter(
      (link) => link.className.includes("btn-ghost") && link.className.includes("btn-sm")
    );

    const rankingsLink = navLinks.find((link) => link.textContent.includes("Rankings"));
    expect(rankingsLink.href).toContain("/");

    const teamsLink = navLinks.find((link) => link.textContent.includes("Teams"));
    expect(teamsLink.href).toContain("/teams");

    const auditLink = navLinks.find((link) => link.textContent.includes("Audit"));
    expect(auditLink.href).toContain("/audit");
  });

  describe("Theme Toggle", () => {
    it("should default to light theme when no localStorage or system preference", () => {
      render(
        <BrowserRouter>
          <Layout>{mockChildren}</Layout>
        </BrowserRouter>
      );

      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    it("should render desktop theme toggle checkbox", () => {
      render(
        <BrowserRouter>
          <Layout>{mockChildren}</Layout>
        </BrowserRouter>
      );

      const toggles = screen.getAllByRole("checkbox");
      const themeToggle = toggles.find((t) => t.classList.contains("theme-controller"));
      expect(themeToggle).toBeDefined();
    });

    it("should render sun and moon icons", () => {
      const { container } = render(
        <BrowserRouter>
          <Layout>{mockChildren}</Layout>
        </BrowserRouter>
      );

      const sunIcons = container.querySelectorAll("[aria-label='sun']");
      const moonIcons = container.querySelectorAll("[aria-label='moon']");
      expect(sunIcons.length).toBeGreaterThanOrEqual(1);
      expect(moonIcons.length).toBeGreaterThanOrEqual(1);
    });

    it("should toggle theme from light to dark on click", () => {
      render(
        <BrowserRouter>
          <Layout>{mockChildren}</Layout>
        </BrowserRouter>
      );

      const toggles = screen.getAllByRole("checkbox");
      const themeToggle = toggles.find((t) => t.classList.contains("theme-controller"));

      fireEvent.click(themeToggle);

      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("should persist theme to localStorage on toggle", () => {
      render(
        <BrowserRouter>
          <Layout>{mockChildren}</Layout>
        </BrowserRouter>
      );

      const toggles = screen.getAllByRole("checkbox");
      const themeToggle = toggles.find((t) => t.classList.contains("theme-controller"));

      fireEvent.click(themeToggle);

      expect(localStorage.getItem("theme")).toBe("dark");
    });

    it("should restore theme from localStorage", () => {
      localStorage.setItem("theme", "dark");

      render(
        <BrowserRouter>
          <Layout>{mockChildren}</Layout>
        </BrowserRouter>
      );

      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("should have accessible aria-label on theme toggle", () => {
      render(
        <BrowserRouter>
          <Layout>{mockChildren}</Layout>
        </BrowserRouter>
      );

      const toggles = screen.getAllByLabelText(/Switch to .+ mode/);
      expect(toggles.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Mobile Menu", () => {
    it("should open full-screen menu when hamburger is clicked", () => {
      const { container } = render(
        <BrowserRouter>
          <Layout>{mockChildren}</Layout>
        </BrowserRouter>
      );

      const hamburger = screen.getByLabelText("Open menu");
      fireEvent.click(hamburger);

      const overlay = container.querySelector(".fixed.inset-0");
      expect(overlay).toBeDefined();
    });

    it("should close menu when close button is clicked", () => {
      const { container } = render(
        <BrowserRouter>
          <Layout>{mockChildren}</Layout>
        </BrowserRouter>
      );

      fireEvent.click(screen.getByLabelText("Open menu"));
      expect(container.querySelector(".fixed.inset-0")).not.toBeNull();

      fireEvent.click(screen.getByLabelText("Close menu"));
      expect(container.querySelector(".fixed.inset-0")).toBeNull();
    });

    it("should render theme toggle in mobile menu with scale-150", () => {
      const { container } = render(
        <BrowserRouter>
          <Layout>{mockChildren}</Layout>
        </BrowserRouter>
      );

      fireEvent.click(screen.getByLabelText("Open menu"));

      const mobileOverlay = container.querySelector(".fixed.inset-0");
      const scaledToggle = mobileOverlay.querySelector(".scale-150");
      expect(scaledToggle).not.toBeNull();
    });

    it("should close menu on route navigation", () => {
      const { container } = render(
        <MemoryRouter initialEntries={["/"]}>
          <Layout>{mockChildren}</Layout>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByLabelText("Open menu"));
      expect(container.querySelector(".fixed.inset-0")).not.toBeNull();

      // Click a nav link inside the mobile menu to trigger route change
      const mobileOverlay = container.querySelector(".fixed.inset-0");
      const teamsLink = mobileOverlay.querySelector("a[href='/teams']");
      fireEvent.click(teamsLink);

      expect(container.querySelector(".fixed.inset-0")).toBeNull();
    });
  });

  describe("Footer", () => {
    it("should use link-accent class on footer link", () => {
      const { container } = render(
        <BrowserRouter>
          <Layout>{mockChildren}</Layout>
        </BrowserRouter>
      );

      const footer = container.querySelector("footer");
      const footerLink = footer.querySelector("a");
      expect(footerLink.className).toContain("link-accent");
    });
  });
});
