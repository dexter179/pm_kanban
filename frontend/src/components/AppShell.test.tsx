import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "@/components/AppShell";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("AppShell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the login form when not signed in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "Not signed in" }, 401))
    );
    render(<AppShell />);

    expect(
      await screen.findByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("shows the board when signed in, and returns to login on logout", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/me") {
        return jsonResponse({ username: "user" });
      }
      if (url === "/api/logout") {
        return jsonResponse({ ok: true });
      }
      if (url === "/api/board") {
        return jsonResponse({
          columns: [{ id: "col-1", title: "Backlog", cardIds: [] }],
          cards: {},
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AppShell />);

    expect(await screen.findByText(/signed in as user/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(
      await screen.findByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });
});
