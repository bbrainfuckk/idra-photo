/**
 * Server-wide guidance delivered in the MCP initialize result. Codex documents that it reads this
 * field; the first 512 characters are kept self-contained on purpose.
 */
export const SERVER_INSTRUCTIONS = `Idra Photo tracks a finite image batch; you make each image with your native image tool (image_gen). Loop: idra_create_batch once, then idra_step. Per job: view_image its reference files if not visible, call image_gen with job.prompt, then idra_step with completed={job_id, attempt_token, artifact_path: the generated file path} (or copy the image to job.save_to and omit artifact_path). That saves it and returns the next job. Continue until status is not "job".

Planning: one prompt + "N photos in the same style" => planning_mode "variations", base_prompt = the user's prompt, references role "style", constraints.style "strict". Use "diversified" only when the user wants different concepts; you then write exactly N concepts. Use "explicit" for a list of exact prompts. Dragged-in images: pass their file path as a reference.
Rules: never generate the same job twice and never reuse an old image. Do not add commentary between images. If image_gen fails or refuses, call idra_report_problem with an honest classification (unknown if unsure); never reword a refused prompt. On paused/blocked, tell the user and stop. After an interruption call idra_status, then idra_reconcile for any open job. Resume only when the user asks.`;
