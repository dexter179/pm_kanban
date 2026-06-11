import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";
import { sendChat } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  sendChat: vi.fn(),
}));

const openSidebar = async () => {
  await userEvent.click(screen.getByRole("button", { name: /ai assistant/i }));
};

const sendMessage = async (text: string) => {
  await userEvent.type(screen.getByPlaceholderText(/ask the assistant/i), text);
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
};

describe("ChatSidebar", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens and closes", async () => {
    render(<ChatSidebar onBoardUpdate={vi.fn()} />);
    await openSidebar();
    expect(screen.getByText("Board Assistant")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /close assistant/i })
    );
    expect(screen.queryByText("Board Assistant")).not.toBeInTheDocument();
  });

  it("sends a message with history and renders both bubbles", async () => {
    vi.mocked(sendChat)
      .mockResolvedValueOnce({ reply: "First answer", board: null })
      .mockResolvedValueOnce({ reply: "Second answer", board: null });
    render(<ChatSidebar onBoardUpdate={vi.fn()} />);
    await openSidebar();

    await sendMessage("First question");
    expect(await screen.findByText("First answer")).toBeInTheDocument();
    expect(sendChat).toHaveBeenCalledWith("First question", []);

    await sendMessage("Second question");
    expect(await screen.findByText("Second answer")).toBeInTheDocument();
    expect(sendChat).toHaveBeenLastCalledWith("Second question", [
      { role: "user", content: "First question" },
      { role: "assistant", content: "First answer" },
    ]);
  });

  it("applies board updates from the AI", async () => {
    const board = { columns: [], cards: {} };
    vi.mocked(sendChat).mockResolvedValue({ reply: "Done", board });
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);
    await openSidebar();

    await sendMessage("Change something");
    await screen.findByText("Done");
    expect(onBoardUpdate).toHaveBeenCalledWith(board);
  });

  it("does not apply a board update when board is null", async () => {
    vi.mocked(sendChat).mockResolvedValue({ reply: "Just chatting", board: null });
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);
    await openSidebar();

    await sendMessage("Hello");
    await screen.findByText("Just chatting");
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("shows an error when the request fails", async () => {
    vi.mocked(sendChat).mockRejectedValue(new Error("boom"));
    render(<ChatSidebar onBoardUpdate={vi.fn()} />);
    await openSidebar();

    await sendMessage("Hello");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /something went wrong/i
    );
  });
});
