# Academic Clearance System

## Process Flow and Test Accounts

This README provides a concise guide to the Academic Clearance System's
user workflows and the test accounts needed to verify the system.

## System Overview

The Academic Clearance System allows students to submit clearance
requirements, department staff to review and process submissions, and
administrators to oversee the clearance process.

## System Process Flow

### Student Workflow

1.  Register or log in to the system.
2.  Open the student dashboard.
3.  Select the clearance requirements for the relevant departments.
4.  Upload the required documents.
5.  Submit the documents for review.
6.  Monitor the status of each department's clearance.
7.  If a submission is rejected, review the department's feedback and
    upload a corrected document.
8.  Repeat the submission process until all departments approve the
    requirements.
9.  Once all requirements are approved, generate or download the
    clearance certificate.

### Department Staff Workflow

1.  Log in using the department staff account.
2.  Open the department dashboard.
3.  View student submissions assigned to the department.
4.  Open and review the submitted documents.
5.  Choose an action:
    -   **Approve** -- Mark the student's requirement as approved.
    -   **Reject** -- Reject the submission and provide a reason or
        feedback.
    -   **Request resubmission** -- Ask the student to submit a
        corrected document, if applicable.
6.  The system updates the submission status and notifies the student.
7.  Continue reviewing pending submissions.

### Administrator Workflow

1.  Log in using the administrator account.
2.  Open the admin dashboard.
3.  View and manage users, departments, and clearance records.
4.  Manage department access and requirements as needed.
5.  Monitor students' overall clearance progress.
6.  Review system activity when necessary.

## Overall Clearance Flow

``` text
Student logs in
      |
      v
Selects department requirements
      |
      v
Uploads and submits documents
      |
      v
Department staff receives submission
      |
      v
Staff reviews submitted documents
      |
      v
   Decision?
    /     \\
   /       \\
Approve   Reject
  |          |
  v          v
Status     Feedback sent
updated       |
  |           v
  |       Student corrects
  |       and resubmits
  |           |
  |___________|
      |
      v
All departments approved?
      |
      v
Generate / download
clearance certificate
```

## Test Accounts

Use the table below to record accounts intended for system testing. The
original project documentation did not provide actual test credentials,
so the values below are placeholders.

  Role                       Login Email / Username   Password
  -------------------------- ------------------------ --------------
  Administrator              Not provided             Not provided
  Student                    Not provided             Not provided
  Library Staff              Not provided             Not provided
  Course Office Staff        Not provided             Not provided
  Guidance Staff             Not provided             Not provided
  Student Council Staff      Not provided             Not provided
  Finance Staff              Not provided             Not provided
  Student Government Staff   Not provided             Not provided
  Cashier Staff              Not provided             Not provided

> **Note:** Add valid test credentials before sharing this README with
> testers. Do not use production account credentials for testing.

## Departments

The clearance process includes the following departments:

-   Library
-   Course Office
-   Guidance
-   Student Council
-   Finance
-   Student Government
-   Cashier
