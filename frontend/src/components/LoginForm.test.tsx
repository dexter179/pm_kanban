import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/LoginForm";

const fillAndSubmit = async (username: string, password: string) => {
  await userEvent.type(screen.getByLabelText(/username/i), username);
  await userEvent.type(screen.getByLabelText(/password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("LoginForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onLogin with the username on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ username: "user" }), { status: 200 })
      )
    );
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    await fillAndSubmit("user", "password");

    expect(fetch).toHaveBeenCalledWith(
      "/api/login",
      expect.objectContaining({ method: "POST" })
    );
    expect(onLogin).toHaveBeenCalledWith("user");
  });

  it("shows an error on invalid credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 }))
    );
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    await fillAndSubmit("user", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid username or password/i
    );
    expect(onLogin).not.toHaveBeenCalled();
  });
});
