# Project Structure & Overview

This repository contains the work for the **RGBI – Dynamic Business Modelling Game** project.  
The goal of the project is to design and build an innovative system that helps businesses make informed, strategic decisions by leveraging operational and strategic data.  
Companies will be able to input goals, KPIs, processes, and structures into a dynamic model that updates automatically when changes occur. This allows organizations to simulate and evaluate outcomes before implementing real-world decisions, with a strong focus on **sustainability (ESG factors)** and **data-driven decision-making**.

---

## Repository Structure

- **Analysis/**
  - **Artefacts/** – Supporting documents like data dictionaries, personas, use cases, and user stories.
  - **Assets/** – Visual references for the Artifacts.

- **Design/**
  - Contains design-related documentation and outputs.

- **Documentation/**
  - **BusinessCase** – Business case document describing the project's purpose, goals, and financials.
  - **Ideas/** – Notes, brainstorms, and supporting idea documents.

- **Implementation/**
  - Development and implementation-related files.

- **Meetings/**
  - Records of project meetings and notes.

- **README**  
  - Overview, general conventions and guidelines.

---

# Internal Collaboration Conventions

To keep our workflow consistent and collaborative, please follow these conventions for branches, commits, issues, and merge requests.

---

## Branches
- Create a dedicated branch for each task or feature.  
- Branch naming convention:  
  ```
  {issue-number}-{type}
  ```
  Example:
  ```
  32-internal-collaboration
  ```

- **Important:**  
  Do not commit directly to `main` or `dev`. Always work on a feature branch.  
  Once the feature is complete, open a merge request for review.

---

## Commits
- Commit messages should follow this structure:  
  ```
  #{issue-number} {type}(scope): {short description}
  ```
- Types: `feat`, `chore`, `delete`, `imp` (improvement), `design`, `analysis`, `realization`  
- Example:  
  ```
  #18 feat/analysis: added jumping monkey
  #18 feat(realization): updated readme with the structure
  ```

---

## Issues
Each issue should include:
- **Title**  
- **Description**  
- **Prerequisites** *(if applicable)*  
- **Acceptance Criteria**  
- **Examples** *(if applicable)*  

---

## Merge Requests
- Provide a **title** and **description** explaining what was changed.  
- After review:  
  - If changes are requested, the **author** is responsible for addressing them.  
  - If there are merge conflicts, the **author** must resolve them before the request can be approved.

---

## Review & Approval
- Merge requests must be reviewed by **someone other than the author** before merging.  
- After the **requested changes** are completed, ask the **reviewer** to merge.

