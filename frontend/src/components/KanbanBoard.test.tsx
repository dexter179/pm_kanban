import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { getBoard, saveBoard } from "@/lib/api";
import { initialData, type BoardData } from "@/lib/kanban";

vi.mock("@/lib/api", () => ({
  getBoard: vi.fn(),
  saveBoard: vi.fn(),
  sendChat: vi.fn(),
}));

const lastSavedBoard = (): BoardData =>
  vi.mocked(saveBoard).mock.lastCall![0];

const renderBoard = async (onLogout = vi.fn()) => {
  render(<KanbanBoard user="user" onLogout={onLogout} />);
  await screen.findAllByTestId(/column-/i);
};

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.mocked(getBoard).mockResolvedValue(structuredClone(initialData));
    vi.mocked(saveBoard).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the board from the API and renders five columns", async () => {
    await renderBoard();
    expect(getBoard).toHaveBeenCalled();
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("shows an error when the board fails to load", async () => {
    vi.mocked(getBoard).mockRejectedValue(new Error("boom"));
    render(<KanbanBoard user="user" onLogout={vi.fn()} />);
    expect(
      await screen.findByText(/could not load your board/i)
    ).toBeInTheDocument();
  });

  it("shows the signed-in user and calls onLogout", async () => {
    const onLogout = vi.fn();
    await renderBoard(onLogout);
    expect(screen.getByText(/signed in as user/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onLogout).toHaveBeenCalled();
  });

  it("renames a column and persists it", async () => {
    await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Z");
    expect(input).toHaveValue("Z");
    expect(lastSavedBoard().columns[0].title).toBe("Z");
  });

  it("adds and removes a card, persisting each change", async () => {
    await renderBoard();
    const column = getFirstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /add a card/i })
    );
    await userEvent.type(
      within(column).getByPlaceholderText(/card title/i),
      "New card"
    );
    await userEvent.type(
      within(column).getByPlaceholderText(/details/i),
      "Notes"
    );
    await userEvent.click(
      within(column).getByRole("button", { name: /add card/i })
    );

    expect(within(column).getByText("New card")).toBeInTheDocument();
    const savedTitles = Object.values(lastSavedBoard().cards).map(
      (card) => card.title
    );
    expect(savedTitles).toContain("New card");

    await userEvent.click(
      within(column).getByRole("button", { name: /delete new card/i })
    );
    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
    const titlesAfterDelete = Object.values(lastSavedBoard().cards).map(
      (card) => card.title
    );
    expect(titlesAfterDelete).not.toContain("New card");
  });

  it("edits a card and persists it", async () => {
    await renderBoard();
    const column = getFirstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );

    const titleInput = within(column).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated title");
    const detailsInput = within(column).getByLabelText("Card details");
    await userEvent.clear(detailsInput);
    await userEvent.type(detailsInput, "Updated details");
    await userEvent.click(
      within(column).getByRole("button", { name: /^save$/i })
    );

    expect(within(column).getByText("Updated title")).toBeInTheDocument();
    expect(within(column).getByText("Updated details")).toBeInTheDocument();
    expect(lastSavedBoard().cards["card-1"]).toMatchObject({
      title: "Updated title",
      details: "Updated details",
    });
  });

  it("cancelling an edit keeps the card unchanged", async () => {
    await renderBoard();
    const column = getFirstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );
    const titleInput = within(column).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Discarded");
    await userEvent.click(
      within(column).getByRole("button", { name: /^cancel$/i })
    );

    expect(within(column).getByText("Align roadmap themes")).toBeInTheDocument();
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("shows an error indicator when saving fails", async () => {
    vi.mocked(saveBoard).mockRejectedValue(new Error("boom"));
    await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.type(input, "!");
    expect(await screen.findByText(/changes not saved/i)).toBeInTheDocument();
  });
});
