import { Component, type ReactNode } from "react";
import { Stack, Text, Button, Paper, Code } from "@mantine/core";
import { AlertCircle } from "lucide-react";
import { createLogger } from "@/shared/logger";

const log = createLogger("error-boundary");

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

function deleteAllDatabases(): Promise<void> {
  return indexedDB
    .databases()
    .then((dbs) =>
      Promise.all(
        dbs
          .filter((db) => db.name)
          .map(
            (db) =>
              new Promise<void>((resolve) => {
                const req = indexedDB.deleteDatabase(db.name!);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              }),
          ),
      ),
    )
    .then(() => {});
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    log.error("レンダリングエラー", error);
    if (info.componentStack) {
      log.error("コンポーネントスタック", info.componentStack as unknown as Error);
    }
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    location.reload();
  };

  private handleClearAndReload = async () => {
    try {
      await deleteAllDatabases();
    } catch {
      // databases() が未対応の環境ではスキップ
    }
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || "不明なエラー";

    return (
      <Stack align="center" justify="center" h="100vh" gap="md" p="xl">
        <AlertCircle size={32} color="var(--mantine-color-red-5)" />
        <Text size="sm" ta="center" fw={600}>
          表示中にエラーが発生しました
        </Text>
        <Paper withBorder p="sm" maw={400} w="100%" style={{ overflow: "auto", maxHeight: 120 }}>
          <Code block style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
            {message}
          </Code>
        </Paper>
        <Stack gap="xs">
          <Button size="xs" onClick={this.handleRetry}>
            再試行
          </Button>
          <Button size="xs" variant="light" onClick={this.handleReload}>
            再読込
          </Button>
          <Button size="xs" variant="outline" color="red" onClick={this.handleClearAndReload}>
            データをクリアして再読込
          </Button>
        </Stack>
        <Text size="xs" c="dimmed" ta="center">
          「データをクリアして再読込」でセッション履歴がリセットされます
        </Text>
      </Stack>
    );
  }
}
