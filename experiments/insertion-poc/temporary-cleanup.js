// Own only failed export candidates explicitly handed over by the exporter.
// Never enumerate storage or enqueue a previous successful result/user file.
export class TemporaryCleanup {
  #pending=new Set();
  get size() {return this.#pending.size;}
  async remove(candidate) {
    try {await candidate.directory.removeEntry(candidate.name);}
    catch(error) {
      if(error?.name!=='NotFoundError') {this.#pending.add(candidate);return false;}
    }
    this.#pending.delete(candidate);
    return true;
  }
  async retry() {
    for(const candidate of [...this.#pending]) await this.remove(candidate);
    return this.#pending.size===0;
  }
}
