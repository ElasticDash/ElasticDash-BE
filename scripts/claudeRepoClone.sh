#!/bin/bash

# This script uses Claude to create an API endpoint for cloning GitHub repositories
# and then creates a PR for the implementation

# Set up variables
BRANCH_NAME="feature/repo-clone-api-$(date +%s)"
MAIN_DIR=$(pwd)

# Step 1: Create a new branch
echo "Creating new branch: $BRANCH_NAME"
git checkout -b $BRANCH_NAME

# Step 2: Use Claude to help implement the API endpoint
claude << EOF
I need to implement a GitHub repository cloning API endpoint for this ElasticDash-API project. The requirements are:

1. Create a new endpoint that accepts a GitHub repository URL
2. Clone the repository to the server, using a timestamp in the folder name to avoid conflicts
3. Return a 201 Created response with the repository name and directory path
4. Ensure there are no conflicts with existing folders before cloning

Please help me:
1. Create a new controller function in the repository.js file
2. Create a new API route to use this controller function
3. Implement proper error handling and validation
4. Ensure the response includes the repo name and directory created

Be sure to follow the existing code patterns and styles in the project.
EOF

# Step 3: After Claude helps implement the code, create a PR
echo "Now creating a Pull Request for the changes..."

# Get the default branch of the repository
DEFAULT_BRANCH=$(git remote show origin | grep 'HEAD branch' | cut -d' ' -f5)
echo "Default branch is: $DEFAULT_BRANCH"

claude << EOF
Now that we've implemented the GitHub repository cloning API endpoint, please help me create a pull request:

1. Create a pull request from the current branch "$BRANCH_NAME" to the default branch "$DEFAULT_BRANCH"
2. Use the title: "Add GitHub repository cloning API endpoint"
3. Include a description that explains:
   - What this PR adds (the new API endpoint for cloning GitHub repositories)
   - How it works (using timestamped folder names to avoid conflicts)
   - What the response format is (repo name and directory path)
   - Any testing that was done

Please create the PR using the gh CLI tool.
EOF

echo "Script completed successfully!"