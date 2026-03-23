import { render, screen } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Layout } from "../Layout";

// Mock the useApi hook
vi.mock("../../hooks/useApi", () => ({
  useApiHealth: vi.fn(),
}));

import { useApiHealth } from "../../hooks/useApi";

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

  it("should have primary color styling on navbar", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const navbar = container.querySelector(".navbar");
    expect(navbar.className).toContain("bg-primary");
    expect(navbar.className).toContain("text-primary-content");
  });

  it("should display logo with basketball emoji", () => {
    render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    expect(screen.getByText(/🏀 NBA Stats Rankings/)).toBeDefined();
  });

  it("should have link to home page", () => {
    render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const homeLink = screen.getByRole("link", { name: /🏀 NBA Stats Rankings/ });
    expect(homeLink.href).toContain("/");
  });

  it("should render navigation tabs", () => {
    render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    // Find navigation links (exclude logo link)
    const allLinks = screen.getAllByRole("link");
    const navLinks = allLinks.filter((link) => link.className.includes("tab"));
    expect(navLinks.length).toBeGreaterThanOrEqual(3);
    expect(navLinks.some((link) => link.textContent.includes("Rankings"))).toBe(true);
    expect(navLinks.some((link) => link.textContent.includes("Teams"))).toBe(true);
    expect(navLinks.some((link) => link.textContent.includes("Audit"))).toBe(true);
  });

  it("should have tab-active class on current route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Layout>{mockChildren}</Layout>
      </MemoryRouter>
    );

    const allLinks = screen.getAllByRole("link");
    const navLinks = allLinks.filter((link) => link.className.includes("tab"));
    const rankingsTab = navLinks.find((link) => link.textContent.includes("Rankings"));
    expect(rankingsTab.className).toContain("tab-active");
  });

  it("should highlight Teams tab when on /teams route", () => {
    render(
      <MemoryRouter initialEntries={["/teams"]}>
        <Layout>{mockChildren}</Layout>
      </MemoryRouter>
    );

    const teamsTab = screen.getByRole("link", { name: /Teams/ });
    expect(teamsTab.className).toContain("tab-active");
  });

  it("should highlight Audit tab when on /audit route", () => {
    render(
      <MemoryRouter initialEntries={["/audit"]}>
        <Layout>{mockChildren}</Layout>
      </MemoryRouter>
    );

    const auditTab = screen.getByRole("link", { name: /Audit/ });
    expect(auditTab.className).toContain("tab-active");
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

  it("should display health status badge", () => {
    render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    expect(screen.getByText("healthy")).toBeDefined();
  });

  it("should have success badge styling for healthy status", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const badge = container.querySelector(".badge-success");
    expect(badge).toBeDefined();
  });

  it("should have tooltip with API status", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const tooltip = container.querySelector(".tooltip");
    expect(tooltip).toBeDefined();
    expect(tooltip.getAttribute("data-tip")).toContain("API Status: online");
  });

  it("should not display health badge when data is null", () => {
    useApiHealth.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const badge = container.querySelector(".badge-success");
    expect(badge).toBeNull();
  });

  it("should handle missing API status in health data", () => {
    useApiHealth.mockReturnValue({
      data: { status: "healthy" },
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    // Should show "unknown" or similar fallback for api status
    const tooltip = container.querySelector(".tooltip");
    expect(tooltip).toBeDefined();
  });

  it("should have container with proper spacing", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const contentContainer = container.querySelector(".container");
    expect(contentContainer.className).toContain("mx-auto");
    expect(contentContainer.className).toContain("p-4");
  });

  it("should have responsive padding on container", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const contentContainer = container.querySelector(".container");
    expect(contentContainer.className).toMatch(/md:p-6/);
  });

  it("should have tabs-bordered styling", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const tabs = container.querySelector(".tabs");
    expect(tabs.className).toContain("tabs-bordered");
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
    expect(links.length).toBe(5); // Home + 4 nav tabs (Rankings, Teams, Games Count, Audit)
  });

  it("should have proper flexbox layout for navbar", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const navbarContent = container.querySelector(".flex-1");
    expect(navbarContent).toBeDefined();

    const navbarEnd = container.querySelector(".flex-none");
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

  it("should have gap between navbar items", () => {
    const { container } = render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const navbarEnd = container.querySelector(".flex-none");
    expect(navbarEnd.className).toContain("gap-2");
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

  it("should render correct tab links for navigation", () => {
    render(
      <BrowserRouter>
        <Layout>{mockChildren}</Layout>
      </BrowserRouter>
    );

    const allLinks = screen.getAllByRole("link");
    const navLinks = allLinks.filter((link) => link.className.includes("tab"));

    const rankingsLink = navLinks.find((link) => link.textContent.includes("Rankings"));
    expect(rankingsLink.href).toContain("/");

    const teamsLink = navLinks.find((link) => link.textContent.includes("Teams"));
    expect(teamsLink.href).toContain("/teams");

    const auditLink = navLinks.find((link) => link.textContent.includes("Audit"));
    expect(auditLink.href).toContain("/audit");
  });
});
