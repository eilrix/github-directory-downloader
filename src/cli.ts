import yargs from 'yargs-parser';
import download from './index';

const cli = async () => {
    const args = yargs(process.argv.slice(2));

    const { url, dir, token, requests } = args;

    const gitUrl = url ?? process.argv[2];

    if (!gitUrl || gitUrl === '') {
        console.log('Error. You need to provide url to GitHub repo');
        return;
    }

    await download(gitUrl, dir, { token, requests });
}

export default cli;