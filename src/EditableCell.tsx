import { useEffect, useState } from "react";
import { type CellContext, type RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    editable?: boolean;
  }
}

export function EditableCell<TData extends RowData>({
  getValue,
  row,
  column,
  table,
}: CellContext<TData, unknown>) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const editable = column.columnDef.meta?.editable ?? false;

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onBlur = () => {
    table.options.meta?.updateData(row.index, column.id, value);
  };

  if (!editable) {
    return <>{value as string}</>;
  }

  return (
    <input
      value={value as string}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      style={{
        all: "unset",
        display: "block",
        width: "100%",
        padding: "var(--table-cell-padding)",
        margin: "calc(var(--table-cell-padding) * -1)",
        cursor: "text",
      }}
    />
  );
}
