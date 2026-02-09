import { useEffect, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useSelection } from "./hooks/useSelection";
import { useCopyToClipboard } from "./hooks/useCopyToClipboard";
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Heading,
  Popover,
  Table,
  Text,
  TextField,
} from "@radix-ui/themes";
import { DownloadIcon, GearIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { EditableCell } from "./EditableCell";
import { NameCell } from "./NameCell";
import { SelectCell } from "./SelectCell";
import { downloadCsv } from "./lib/downloadCsv";

const departmentOptions = ["営業部", "開発部", "人事部", "総務部", "経理部"];

type User = {
  id: number;
  name: string;
  age: number;
  email: string;
  department: string;
};

const defaultData: User[] = [
  { id: 1, name: "田中太郎", age: 28, email: "tanaka@example.com", department: "営業部" },
  { id: 2, name: "鈴木花子", age: 34, email: "suzuki@example.com", department: "開発部" },
  { id: 3, name: "佐藤一郎", age: 45, email: "sato@example.com", department: "人事部" },
  { id: 4, name: "高橋美咲", age: 29, email: "takahashi@example.com", department: "開発部" },
  { id: 5, name: "山田健太", age: 38, email: "yamada@example.com", department: "営業部" },
];

const columnHelper = createColumnHelper<User>();

const columns = [
  columnHelper.accessor("id", {
    header: "ID",
    cell: EditableCell,
    meta: { editable: false },
  }),
  columnHelper.accessor("name", {
    header: "名前",
    cell: NameCell,
  }),
  columnHelper.accessor("age", {
    header: "年齢",
    cell: EditableCell,
    meta: { editable: true, type: "number" },
  }),
  columnHelper.accessor("email", {
    header: "メールアドレス",
    cell: EditableCell,
    meta: { editable: true },
  }),
  columnHelper.accessor("department", {
    header: "部署",
    cell: SelectCell,
    meta: { options: departmentOptions },
  }),
];

const sortIndicator: Record<string, string> = {
  asc: " ↑",
  desc: " ↓",
  none: " ↑↓",
};

export default function App() {
  const [data, setData] = useState(defaultData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const tableRef = useRef<HTMLDivElement>(null);

  const {
    selected,
    isDragging,
    isSelected,
    clearSelection,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleMouseUp,
  } = useSelection();

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: {
      updateData: (rowIndex, columnId, value) => {
        setData((prev) =>
          prev.map((row, index) =>
            index === rowIndex ? { ...row, [columnId]: value } : row
          )
        );
      },
      clearSelection,
    },
  });

  useCopyToClipboard(table, selected);

  // Clear selection when sort order or filter changes
  useEffect(() => {
    clearSelection();
  }, [sorting, globalFilter, columnVisibility, clearSelection]);

  // Global mouseup to end drag
  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  // Escape to clear selection + click outside table to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    const handleOutsideClick = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        clearSelection();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [clearSelection]);

  return (
    <Box p="5">
      <Heading size="5" mb="4">
        TanStack Table サンプル
      </Heading>
      <Flex gap="3" mb="3" align="end">
        <Box maxWidth="300px" flexGrow="1">
          <TextField.Root
            placeholder="検索..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          >
            <TextField.Slot>
              <MagnifyingGlassIcon />
            </TextField.Slot>
          </TextField.Root>
        </Box>
        <Popover.Root>
          <Popover.Trigger>
            <Button variant="soft">
              <GearIcon /> 表示カラム
            </Button>
          </Popover.Trigger>
          <Popover.Content>
            <Flex direction="column" gap="2">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <Text as="label" size="2" key={column.id}>
                    <Flex gap="2" align="center">
                      <Checkbox
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      />
                      {typeof column.columnDef.header === "string"
                        ? column.columnDef.header
                        : column.id}
                    </Flex>
                  </Text>
                ))}
            </Flex>
          </Popover.Content>
        </Popover.Root>
        <Button variant="soft" onClick={() => downloadCsv(table)}>
          <DownloadIcon /> CSV出力
        </Button>
      </Flex>
      <Table.Root
        ref={tableRef}
        variant="surface"
        className={isDragging ? "selecting" : undefined}
        style={{ overflowX: "auto" }}
      >
          <Table.Header>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Row key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Table.ColumnHeaderCell
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{
                      cursor: "pointer",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {sortIndicator[(header.column.getIsSorted() || "none") as string]}
                  </Table.ColumnHeaderCell>
                ))}
              </Table.Row>
            ))}
          </Table.Header>
          <Table.Body>
            {table.getRowModel().rows.map((row, ri) => (
              <Table.Row key={row.id}>
                {row.getVisibleCells().map((cell, ci) => (
                  <Table.Cell
                    key={cell.id}
                    className={
                      isSelected(ri, ci) ? "cell-selected" : undefined
                    }
                    style={{ whiteSpace: "nowrap" }}
                    onMouseDown={(e) => handleCellMouseDown(ri, ci, e)}
                    onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
      </Table.Root>
    </Box>
  );
}
