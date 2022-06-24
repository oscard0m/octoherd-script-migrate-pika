// @ts-check
import { composeCreatePullRequest } from "octokit-plugin-create-pull-request";

/**
 * Migrate occurrences of 'pika build' to 'pika-pack build' in package.json for all the repositories of a GitHub Organization
 *
 * @param {import('@octoherd/cli').Octokit} octokit
 * @param {import('@octoherd/cli').Repository} repository
 */
export async function script(octokit, repository) {
  if (repository.archived) {
    octokit.log.info(`${repository.html_url} is archived, ignoring.`);
    return;
  }

  const owner = repository.owner.login;
  const repo = repository.name;

  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        mediaType: {
          format: "raw",
        },
        owner,
        repo,
        path: "package.json",
      }
    );

    const packageJson = JSON.parse(data);

    const buildScript = packageJson.scripts.build;

    if (buildScript === "pika build") {
      const { data: pr } = await composeCreatePullRequest(octokit, {
        owner,
        repo,
        title: "build(npm): replace 'pika' command with 'pika-pack'",
        body: `# Description\nReplace build script in package.json from \`pika build\` to \`pika-pack build.\`\nYou can read more about this in [Pika Release Notes](https://github.com/FredKSchott/pika-pack/releases/tag/v0.5.0)\n\n# Context\nAvoid Release issues like the one reported [here](https://github.com/octokit/plugin-retry.js/issues/321)`,
        head: "fix-pika-build-script",
        changes: [
          {
            files: {
              "package.json": ({ encoding, content }) => {
                const pkg = JSON.parse(
                  Buffer.from(content, encoding).toString("utf-8")
                );

                pkg.scripts.build = pkg.scripts.build.replace(
                  "pika",
                  "pika-pack"
                );

                return JSON.stringify(pkg, null, 2) + "\n";
              },
            },
            commit: "build(npm): replace 'pika' command with 'pika-pack'",
          },
        ],
      });

      octokit.log.info("Pull request created: %s", pr.html_url);
    } else if (buildScript === "pika-pack build") {
      octokit.log.info(
        "package.json build script already migrated for: %s",
        `${owner}/${repo}`
      );
    }
  } catch (e) {
    octokit.log.error(e);
  }
}
